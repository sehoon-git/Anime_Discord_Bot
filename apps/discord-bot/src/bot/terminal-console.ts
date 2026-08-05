import * as readline from 'node:readline';

export type TerminalLogLevel = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
export type TerminalCommandResult = string | string[] | undefined;
export type TerminalCommandHandler = (command: string) => Promise<TerminalCommandResult> | TerminalCommandResult;

class TerminalConsole {
  private active = false;
  private interface?: readline.Interface;
  private commandHandler?: TerminalCommandHandler;
  private readonly logLines: string[] = [];

  start(commandHandler: TerminalCommandHandler): void {
    if (this.active || !process.stdin.isTTY || !process.stdout.isTTY) return;
    this.active = true;
    this.commandHandler = commandHandler;
    this.interface = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    this.interface.setPrompt('Seline command > ');
    this.interface.on('line', (line) => void this.handleCommand(line));
    this.interface.on('SIGINT', () => void this.handleCommand('exit'));
    process.stdout.on('resize', () => this.redraw());
    this.redraw();
  }

  write(level: TerminalLogLevel, source: string, details: unknown[]): void {
    const timestamp = new Date().toLocaleTimeString('en-GB');
    const message = details.map(formatDetail).join(' | ').replace(/[\r\n]+/g, ' ') || 'No message';
    if (!this.active || !this.interface) {
      writePlain(level, source, message);
      return;
    }

    this.logLines.push(...formatCuiLines(level, source, message, timestamp, this.columns()));
    if (this.logLines.length > 400) this.logLines.splice(0, this.logLines.length - 400);
    this.redraw();
  }

  clear(): void {
    if (!this.active || !this.interface) return;
    this.logLines.length = 0;
    this.redraw();
  }

  private async handleCommand(raw: string): Promise<void> {
    const command = raw.trim();
    if (!command) {
      this.redraw();
      return;
    }
    try {
      const result = await this.commandHandler?.(command);
      const lines = Array.isArray(result) ? result : result ? [result] : [];
      for (const line of lines) this.write('INFO', 'console', [line]);
      if (!lines.length) this.redraw();
    } catch (error) {
      this.write('CRITICAL', 'console', [error]);
    }
  }

  private redraw(): void {
    if (!this.active || !this.interface) return;
    const rows = this.rows();
    const columns = this.columns();
    const logCapacity = Math.max(1, rows - 3);
    const visible = this.logLines.slice(-logCapacity);
    const blankCount = Math.max(0, logCapacity - visible.length);
    const header = fitLine(' Seline bot console — logs ', columns);
    const divider = '\u001b[2m' + '─'.repeat(columns) + '\u001b[0m';

    // The log pane is redrawn independently. The readline prompt is always
    // rendered last at the physical bottom row, so log output cannot move it.
    process.stdout.write('\u001b[?25l\u001b[2J\u001b[H');
    process.stdout.write(`\u001b[1;36m${header}\u001b[0m\n`);
    for (const line of visible) process.stdout.write(`${line}\u001b[2K\n`);
    for (let index = 0; index < blankCount; index += 1) process.stdout.write('\u001b[2K\n');
    process.stdout.write(`${divider}\u001b[2K`);
    process.stdout.write(`\u001b[${rows};1H\u001b[2K`);
    this.interface.prompt(true);
    process.stdout.write('\u001b[?25h');
  }

  private rows(): number {
    return Math.max(8, process.stdout.rows ?? 30);
  }

  private columns(): number {
    return Math.max(60, process.stdout.columns ?? 110);
  }
}

export const terminalConsole = new TerminalConsole();

function formatCuiLines(level: TerminalLogLevel, source: string, message: string, timestamp: string, columns: number): string[] {
  const plain = fitLine(`[${timestamp}] ${level.padEnd(8)} [${source}] ${message}`, columns);
  if (level === 'INFO') return [plain];

  const palette =
    level === 'SUCCESS'
      ? { color: '\u001b[1;32m', background: '\u001b[30;42m' }
      : level === 'WARNING'
        ? { color: '\u001b[38;5;208m', background: '\u001b[30;48;5;208m' }
        : { color: '\u001b[1;31m', background: '\u001b[97;41m' };
  const reset = '\u001b[0m';
  const line = palette.color + '═'.repeat(columns) + reset;
  const title = fitLine(` ${level} | ${source} | ${timestamp} `, columns);
  return [line, palette.background + title + reset, palette.color + fitLine(message, columns) + reset, line];
}

function fitLine(text: string, columns: number): string {
  if (text.length <= columns) return text;
  return `${text.slice(0, Math.max(1, columns - 1))}…`;
}

function writePlain(level: TerminalLogLevel, source: string, message: string): void {
  if (level === 'INFO') {
    console.info(`[${source}] ${message}`);
    return;
  }
  const output = decorate(level, source, message, new Date().toISOString());
  if (level === 'SUCCESS') console.info(output);
  else console.error(output);
}

function decorate(level: Exclude<TerminalLogLevel, 'INFO'>, source: string, message: string, timestamp: string): string {
  const palette =
    level === 'SUCCESS'
      ? { color: '\u001b[1;32m', background: '\u001b[30;42m' }
      : level === 'WARNING'
        ? { color: '\u001b[38;5;208m', background: '\u001b[30;48;5;208m' }
        : { color: '\u001b[1;31m', background: '\u001b[97;41m' };
  const reset = '\u001b[0m';
  const line = '='.repeat(88);
  return `\n${palette.color}${line}${reset}\n${palette.background} ${level} | ${source} | ${timestamp} ${reset}\n${palette.color}${message}${reset}\n${palette.color}${line}${reset}\n`;
}

function formatDetail(value: unknown): string {
  if (value instanceof Error) return value.stack ?? value.message;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}