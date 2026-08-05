import { terminalConsole } from './terminal-console.js';

export function createConsoleLogger(source: string): Pick<Console, 'error' | 'info' | 'warn'> {
  return {
    error: (...details: unknown[]) => terminalConsole.write('CRITICAL', source, details),
    warn: (...details: unknown[]) => terminalConsole.write('WARNING', source, details),
    info: (...details: unknown[]) => terminalConsole.write('INFO', source, details)
  };
}