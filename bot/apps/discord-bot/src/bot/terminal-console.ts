import { timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import * as readline from 'node:readline';

export type TerminalLogLevel = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
export type TerminalLogMode = 'compact' | 'detail';
export type TerminalCommandResult = string | string[] | undefined;
export type TerminalCommandHandler = (command: string) => Promise<TerminalCommandResult> | TerminalCommandResult;

const TERMINAL_COMMANDS = ['help', 'status', 'announce', 'logs compact', 'logs detail', 'voice leave', 'clear', 'restart', 'exit'] as const;
const PROMPT = 'Seline command > ';
// Keep the current search hit, query input, and keyboard help on separate
// rows. A log line can be long enough to make a shared status row unreadable.
const RESERVED_BOTTOM_ROWS = 3;
const MAX_LOG_HISTORY = 500;
export type ConsolePasswordAttempt = {
  authenticated: boolean;
  locked: boolean;
  remainingAttempts: number;
  lockRemainingMs: number;
};

export class ConsolePasswordGuard {
  private failedAttempts = 0;
  private lockedUntil = 0;

  constructor(private readonly password: string) {}

  isLocked(now = Date.now()): boolean {
    return this.getLockRemainingMs(now) > 0;
  }

  getLockRemainingMs(now = Date.now()): number {
    return Math.max(0, this.lockedUntil - now);
  }

  submit(candidate: string, now = Date.now()): ConsolePasswordAttempt {
    const lockRemainingMs = this.getLockRemainingMs(now);
    if (lockRemainingMs > 0) return { authenticated: false, locked: true, remainingAttempts: 0, lockRemainingMs };

    const expected = Buffer.from(this.password);
    const actual = Buffer.from(candidate);
    const authenticated = expected.length === actual.length && timingSafeEqual(expected, actual);
    if (authenticated) {
      this.failedAttempts = 0;
      return { authenticated: true, locked: false, remainingAttempts: 5, lockRemainingMs: 0 };
    }

    this.failedAttempts += 1;
    if (this.failedAttempts >= 5) {
      this.failedAttempts = 0;
      this.lockedUntil = now + 30_000;
      return { authenticated: false, locked: true, remainingAttempts: 0, lockRemainingMs: 30_000 };
    }

    return { authenticated: false, locked: false, remainingAttempts: 5 - this.failedAttempts, lockRemainingMs: 0 };
  }
}

class TerminalConsole {
  private active = false;
  private layoutActive = false;
  private inputLine = '';
  private inputCursor = 0;
  private stdinWasRaw = false;
  private authenticated = false;
  private passwordGuard?: ConsolePasswordGuard;
  private passwordLockTimer?: NodeJS.Timeout;
  private readonly settingsPath = resolveConsoleSettingsPath();
  private logMode: TerminalLogMode = readSavedLogMode(this.settingsPath);
  private interface?: readline.Interface;
  private commandHandler?: TerminalCommandHandler;
  private logHistory: string[] = [];
  private searchActive = false;
  private searchQuery = '';
  private searchCursor = 0;
  private searchIndex = 0;

  start(commandHandler: TerminalCommandHandler, password?: string): void {
    if (this.active || !process.stdin.isTTY || !process.stdout.isTTY) return;
    this.active = true;
    this.commandHandler = commandHandler;
    this.passwordGuard = password ? new ConsolePasswordGuard(password) : undefined;
    this.authenticated = false;
    this.stdinWasRaw = process.stdin.isRaw === true;
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.on('keypress', this.handleKeypress);
    process.stdout.on('resize', () => this.refreshLayout());
    process.once('exit', () => this.restoreLayout());

    this.configureLayout();
    this.writeLogLines(['=== Seline bot console - logs ===']);
    this.renderBottom();
  }

  write(level: TerminalLogLevel, source: string, details: unknown[]): void {
    const timestamp = new Date().toLocaleTimeString('en-GB');
    const message = details.map(formatDetail).join(' | ').replace(/[\r\n]+/g, ' ') || 'No message';
    if (!this.active) {
      writePlain(level, source, message, timestamp);
      return;
    }
    const output = level === 'INFO'
      ? `[${timestamp}] INFO     [${source}] ${message}`
      : decorate(level, source, message, timestamp);
    this.writeLogLines(output.split(/\r?\n/));
    this.renderBottom();
  }

  detail(source: string, details: unknown[]): void {
    if (this.logMode !== 'detail') return;
    this.write('INFO', source, details);
  }

  setLogMode(mode: TerminalLogMode): void {
    this.logMode = mode;
    saveLogMode(this.settingsPath, mode);
  }

  getLogMode(): TerminalLogMode {
    return this.logMode;
  }

  shutdown(): void {
    process.stdin.off('keypress', this.handleKeypress);
    if (!this.stdinWasRaw) process.stdin.setRawMode(false);
    process.stdin.pause();
    this.restoreLayout();
    this.active = false;
  }

  clear(): void {
    if (!this.active) return;
    process.stdout.write('\u001b[2J\u001b[H');
    this.configureLayout();
    this.writeLogLines(['=== Seline bot console - logs ===']);
    this.renderBottom();
  }

  private async handleCommand(raw: string): Promise<void> {
    const command = raw.trim();
    if (!command) {
      this.renderBottom();
      return;
    }
    try {
      const result = await this.commandHandler?.(command);
      const lines = Array.isArray(result) ? result : result ? [result] : [];
      if (lines.length) this.writeCommandResult(lines);
      else this.renderBottom();
    } catch (error) {
      this.write('CRITICAL', 'console', [error]);
    }
  }

  private writeCommandResult(lines: string[]): void {
    if (!this.active) {
      process.stdout.write(`${lines.join('\n')}\n`);
      return;
    }
    this.writeLogLines(lines.flatMap((line) => line.split(/\r?\n/)));
    this.renderBottom();
  }

  private refreshLayout(): void {
    if (!this.active) return;
    process.stdout.write('\\u001b[2J\\u001b[H');
    this.configureLayout();
    this.writeLogLines(this.logHistory, false);
    this.renderBottom();
  }

  private configureLayout(): void {
    const { logBottom } = this.layout();
    process.stdout.write(`\u001b[1;${logBottom}r\u001b[?25h`);
    this.layoutActive = true;
  }

  private restoreLayout(): void {
    if (!this.layoutActive) return;
    const { rows } = this.layout();
    process.stdout.write(`\u001b[r\u001b[${rows};1H\u001b[2K\u001b[?25h\n`);
    this.layoutActive = false;
  }

  private writeLogLines(lines: string[], record = true): void {
    const { logBottom } = this.layout();
    for (const line of lines) {
      if (record) {
        this.logHistory.push(line);
        if (this.logHistory.length > MAX_LOG_HISTORY) this.logHistory.splice(0, this.logHistory.length - MAX_LOG_HISTORY);
      }
      // Write only in the scrolling region. renderBottom() redraws the two
      // reserved input rows afterwards; cursor save/restore caused Windows
      // terminals to splice the prompt into asynchronous log messages.
      process.stdout.write(`\u001b[${logBottom};1H\u001b[2K${line}\n`);
    }
  }

  private renderBottom(): void {
    if (!this.layoutActive) return;
    const { rows, columns } = this.layout();
    const resultRow = rows - 2;
    const commandRow = rows - 1;
    const statusRow = rows;
    const passwordPrompt = !this.authenticated;
    const searchPrompt = this.authenticated && this.searchActive;
    const prompt = passwordPrompt ? 'Console password > ' : searchPrompt ? 'Search logs > ' : PROMPT;
    const inputLine = searchPrompt ? this.searchQuery : this.inputLine;
    const inputCursor = searchPrompt ? this.searchCursor : this.inputCursor;
    const maxInputLength = Math.max(1, columns - prompt.length - 1);
    const visibleInput = inputLine.slice(0, maxInputLength);
    const displayedInput = passwordPrompt ? '*'.repeat(visibleInput.length) : visibleInput;
    const suggestion = !passwordPrompt && !searchPrompt && inputCursor === inputLine.length ? inlineTerminalSuggestion(inputLine) : '';
    const visibleSuggestion = suggestion.slice(0, Math.max(0, columns - prompt.length - displayedInput.length - 1));
    const matches = searchPrompt ? searchLogLines(this.logHistory, this.searchQuery) : [];
    const activeMatch = matches.length ? matches[this.searchIndex % matches.length] : undefined;
    const status = passwordPrompt
      ? terminalPasswordStatus(this.passwordGuard)
      : searchPrompt
        ? terminalSearchStatus(this.searchQuery, matches.length, this.searchIndex)
        : terminalModeStatus(this.logMode);
    const result = searchPrompt
      ? terminalSearchResult(this.searchQuery, matches.length, this.searchIndex, activeMatch)
      : '';
    const cursorColumn = Math.min(prompt.length + inputCursor, columns - 1) + 1;

    process.stdout.write('\u001b[' + resultRow + ';1H\u001b[2K\u001b[90m' + result.slice(0, Math.max(1, columns - 1)) + '\u001b[0m');
    process.stdout.write('\u001b[' + commandRow + ';1H\u001b[2K' + prompt + displayedInput + '\u001b[90m' + visibleSuggestion + '\u001b[0m');
    process.stdout.write('\u001b[' + statusRow + ';1H\u001b[2K\u001b[90m' + status.slice(0, Math.max(1, columns - 1)) + '\u001b[0m');
    process.stdout.write('\u001b[' + commandRow + ';' + cursorColumn + 'H');
  }
  private submitPassword(): void {
    const guard = this.passwordGuard;
    const candidate = this.inputLine;
    this.inputLine = '';
    this.inputCursor = 0;
    if (!guard) {
      this.writeCommandResult(['Console is locked. Set BOT_CONSOLE_PASSWORD in bot/.env and restart Seline.']);
      return;
    }

    const result = guard.submit(candidate);
    if (result.authenticated) {
      this.authenticated = true;
      this.writeCommandResult(['Console unlocked.']);
      return;
    }

    if (result.locked) {
      if (this.passwordLockTimer) clearTimeout(this.passwordLockTimer);
      this.passwordLockTimer = setTimeout(() => this.renderBottom(), result.lockRemainingMs);
      this.writeCommandResult(['Incorrect password. Console locked for 30 seconds.']);
      return;
    }

    this.writeCommandResult(['Incorrect password. ' + result.remainingAttempts + ' attempts remaining.']);
  }

  private readonly handleKeypress = (input: string, key: readline.Key): void => {
    if (key?.ctrl && key.name === 'c') {
      void this.handleCommand('exit');
      return;
    }
    if (!this.authenticated && this.passwordGuard?.isLocked()) {
      this.inputLine = '';
      this.inputCursor = 0;
      this.renderBottom();
      return;
    }
    if (key?.ctrl && key.name === 'f') {
      if (!this.authenticated) {
        this.renderBottom();
        return;
      }
      this.searchActive = !this.searchActive;
      if (this.searchActive) {
        this.searchQuery = '';
        this.searchCursor = 0;
        this.searchIndex = 0;
      }
      this.renderBottom();
      return;
    }
    if (this.searchActive) {
      this.handleSearchKeypress(input, key);
      return;
    }
    if (key?.name === 'f2') {
      if (!this.authenticated) {
        this.renderBottom();
        return;
      }
      this.setLogMode(toggleTerminalLogMode(this.logMode));
      this.writeCommandResult(['Log mode switched to ' + this.logMode + '.']);
      return;
    }
    if (key?.name === 'return' || key?.name === 'enter') {
      if (!this.authenticated) {
        this.submitPassword();
        return;
      }
      const command = this.inputLine;
      this.inputLine = '';
      this.inputCursor = 0;
      this.renderBottom();
      void this.handleCommand(command);
      return;
    }
    if (key?.name === 'tab' && this.authenticated) {
      const [matches] = completeTerminalCommand(this.inputLine);
      if (matches.length === 1) {
        this.inputLine = matches[0];
        this.inputCursor = this.inputLine.length;
      }
    } else if (key?.name === 'backspace' || input === '\u007f' || input === '\b') {
      if (this.inputCursor > 0) {
        this.inputLine = this.inputLine.slice(0, this.inputCursor - 1) + this.inputLine.slice(this.inputCursor);
        this.inputCursor -= 1;
      }
    } else if (key?.name === 'delete') {
      this.inputLine = this.inputLine.slice(0, this.inputCursor) + this.inputLine.slice(this.inputCursor + 1);
    } else if (key?.name === 'left') {
      this.inputCursor = Math.max(0, this.inputCursor - 1);
    } else if (key?.name === 'right') {
      this.inputCursor = Math.min(this.inputLine.length, this.inputCursor + 1);
    } else if (key?.name === 'home') {
      this.inputCursor = 0;
    } else if (key?.name === 'end') {
      this.inputCursor = this.inputLine.length;
    } else if (input && !key?.ctrl && !key?.meta) {
      this.inputLine = this.inputLine.slice(0, this.inputCursor) + input + this.inputLine.slice(this.inputCursor);
      this.inputCursor += input.length;
    }
    this.renderBottom();
  };
  private handleSearchKeypress(input: string, key: readline.Key): void {
    if (key?.name === 'escape') {
      this.searchActive = false;
      this.renderBottom();
      return;
    }
    const matches = searchLogLines(this.logHistory, this.searchQuery);
    if ((key?.name === 'return' || key?.name === 'enter' || key?.name === 'down') && matches.length) {
      this.searchIndex = (this.searchIndex + 1) % matches.length;
    } else if (key?.name === 'up' && matches.length) {
      this.searchIndex = (this.searchIndex - 1 + matches.length) % matches.length;
    } else if (key?.name === 'backspace' || input === '\u007f' || input === '\b') {
      if (this.searchCursor > 0) {
        this.searchQuery = this.searchQuery.slice(0, this.searchCursor - 1) + this.searchQuery.slice(this.searchCursor);
        this.searchCursor -= 1;
        this.searchIndex = 0;
      }
    } else if (key?.name === 'delete') {
      this.searchQuery = this.searchQuery.slice(0, this.searchCursor) + this.searchQuery.slice(this.searchCursor + 1);
      this.searchIndex = 0;
    } else if (key?.name === 'left') {
      this.searchCursor = Math.max(0, this.searchCursor - 1);
    } else if (key?.name === 'right') {
      this.searchCursor = Math.min(this.searchQuery.length, this.searchCursor + 1);
    } else if (key?.name === 'home') {
      this.searchCursor = 0;
    } else if (key?.name === 'end') {
      this.searchCursor = this.searchQuery.length;
    } else if (input && !key?.ctrl && !key?.meta) {
      this.searchQuery = this.searchQuery.slice(0, this.searchCursor) + input + this.searchQuery.slice(this.searchCursor);
      this.searchCursor += input.length;
      this.searchIndex = 0;
    }
    this.renderBottom();
  }

  private layout(): { rows: number; columns: number; logBottom: number } {
    const rows = Math.max(process.stdout.rows || 24, RESERVED_BOTTOM_ROWS + 2);
    const columns = Math.max(process.stdout.columns || 80, 40);
    return { rows, columns, logBottom: rows - RESERVED_BOTTOM_ROWS };
  }
}

export const terminalConsole = new TerminalConsole();

export function searchLogLines(lines: readonly string[], query: string): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return lines.filter((line) => line.toLowerCase().includes(normalized));
}

export function terminalSearchResult(query: string, matchCount: number, matchIndex: number, activeMatch?: string): string {
  if (!query.trim()) return 'Search results will appear here.';
  if (!matchCount) return `No matches for "${query}"`;
  return `${matchIndex % matchCount + 1}/${matchCount}: ${activeMatch ?? ''}`;
}

export function terminalSearchStatus(query: string, matchCount: number, matchIndex: number): string {
  if (!query.trim()) return 'Type to search logs | Enter/Down next | Up previous | Esc or Ctrl+F close';
  if (!matchCount) return `No matches for "${query}" | Esc or Ctrl+F close`;
  return `${matchIndex % matchCount + 1}/${matchCount} matches | Enter/Down next | Up previous | Esc close`;
}

export function completeTerminalCommand(line: string): [string[], string] {
  const matches = terminalCommandMatches(line);
  const query = line.trimStart().toLowerCase();
  const allCandidates = query.startsWith('voice') ? ['voice leave'] : query.startsWith('logs') ? ['logs compact', 'logs detail'] : [...TERMINAL_COMMANDS];
  return [matches.length ? matches : allCandidates, line];
}

export function inlineTerminalSuggestion(line: string): string {
  const query = line.trimStart().toLowerCase();
  if (!query) return '';
  const matches = terminalCommandMatches(line);
  if (!matches.length) return '';
  if (matches.length === 1) return matches[0] === query ? '' : matches[0].slice(query.length);
  return `  [Tab: ${matches.join(' | ')}]`;
}

export function toggleTerminalLogMode(mode: TerminalLogMode): TerminalLogMode {
  return mode === 'detail' ? 'compact' : 'detail';
}


export function terminalPasswordStatus(guard?: ConsolePasswordGuard): string {
  if (!guard) return 'Console locked: set BOT_CONSOLE_PASSWORD in bot/.env, then restart.';
  const remainingMs = guard.getLockRemainingMs();
  if (remainingMs > 0) return 'Console locked: try again in ' + Math.ceil(remainingMs / 1000) + ' seconds.';
  return 'Console locked: enter password.';
}
export function terminalModeStatus(mode: TerminalLogMode): string {
  return mode === 'detail'
    ? 'Log mode: detail | Ctrl+F search | F2 toggle | Tab complete | help: commands'
    : 'Log mode: compact | Ctrl+F search | F2 toggle | Tab complete | help: commands';
}
function terminalCommandMatches(line: string): string[] {
  const query = line.trimStart().toLowerCase();
  const candidates = query.startsWith('voice') ? ['voice leave'] : query.startsWith('logs') ? ['logs compact', 'logs detail'] : [...TERMINAL_COMMANDS];
  return candidates.filter((candidate) => candidate.startsWith(query));
}

function writePlain(level: TerminalLogLevel, source: string, message: string, timestamp: string): void {
  if (level === 'INFO') return void console.info(`[${source}] ${message}`);
  const output = decorate(level, source, message, timestamp);
  if (level === 'SUCCESS') console.info(output);
  else console.error(output);
}

function decorate(level: Exclude<TerminalLogLevel, 'INFO'>, source: string, message: string, timestamp: string): string {
  const palette = level === 'SUCCESS' ? { color: '\u001b[1;32m', background: '\u001b[30;42m' } : level === 'WARNING' ? { color: '\u001b[38;5;208m', background: '\u001b[30;48;5;208m' } : { color: '\u001b[1;31m', background: '\u001b[97;41m' };
  const reset = '\u001b[0m';
  const line = '='.repeat(88);
  return `\n${palette.color}${line}${reset}\n${palette.background} ${level} | ${source} | ${timestamp} ${reset}\n${palette.color}${message}${reset}\n${palette.color}${line}${reset}\n`;
}

function formatDetail(value: unknown): string {
  if (value instanceof Error) return value.stack ?? value.message;
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

function resolveConsoleSettingsPath(): string {
  let directory = process.cwd();
  while (true) {
    if (existsSync(join(directory, 'start-seline.ps1'))) return join(directory, 'data', 'seline-console-settings.json');
    const parent = dirname(directory);
    if (parent === directory) return resolve(process.cwd(), 'data', 'seline-console-settings.json');
    directory = parent;
  }
}

function readSavedLogMode(settingsPath: string): TerminalLogMode {
  try {
    if (!existsSync(settingsPath)) return 'compact';
    const saved = JSON.parse(readFileSync(settingsPath, 'utf8')) as { logMode?: unknown };
    return saved.logMode === 'detail' ? 'detail' : 'compact';
  } catch {
    return 'compact';
  }
}

function saveLogMode(settingsPath: string, logMode: TerminalLogMode): void {
  try {
    mkdirSync(dirname(settingsPath), { recursive: true });
    const temporaryPath = `${settingsPath}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify({ logMode }, null, 2), 'utf8');
    renameSync(temporaryPath, settingsPath);
  } catch {
    // The console remains usable if local preferences cannot be persisted.
  }
}