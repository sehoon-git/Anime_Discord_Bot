import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

type VoiceServiceManagerOptions = {
  baseUrl: string;
  serviceDirectory?: string;
  startupTimeoutMs?: number;
  logger?: Pick<Console, 'error' | 'info' | 'warn'>;
};

export class VoiceServiceManager {
  private readonly baseUrl: string;
  private readonly serviceDirectory: string;
  private readonly startupTimeoutMs: number;
  private readonly logger: Pick<Console, 'error' | 'info' | 'warn'>;
  private child?: ChildProcess;
  private startup?: Promise<void>;
  private lastError?: string;

  constructor(options: VoiceServiceManagerOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.serviceDirectory = options.serviceDirectory ?? resolve(process.cwd(), 'apps', 'voice-service');
    this.startupTimeoutMs = options.startupTimeoutMs ?? 20_000;
    this.logger = options.logger ?? console;
  }

  async ensureReady(): Promise<void> {
    if (await this.isHealthy()) return;
    if (!this.isLocalService()) {
      throw new Error(`음성 서비스에 연결할 수 없습니다: ${this.baseUrl}`);
    }

    this.startup ??= this.startAndWait();
    try {
      await this.startup;
    } finally {
      this.startup = undefined;
    }
  }

  statusMessage(): string {
    return this.lastError ?? `음성 서비스(${this.baseUrl})를 시작하거나 연결하지 못했습니다.`;
  }

  stop(): void {
    this.child?.kill();
    this.child = undefined;
  }

  private async startAndWait(): Promise<void> {
    if (!this.child) this.startChild();
    const deadline = Date.now() + this.startupTimeoutMs;
    while (Date.now() < deadline) {
      if (await this.isHealthy()) {
        this.logger.info(`음성 서비스 준비 완료: ${this.baseUrl}`);
        return;
      }
      if (!this.child || this.child.exitCode !== null) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    this.stop();
    throw new Error(this.statusMessage());
  }

  private startChild(): void {
    const python = this.pythonExecutable();
    if (!python) {
      this.lastError = `음성 서비스 Python 실행 파일을 찾을 수 없습니다: ${this.serviceDirectory}\\.venv`;
      throw new Error(this.lastError);
    }

    const ffmpeg = process.env.FFMPEG_BIN ?? resolve(process.cwd(), 'tools', 'ffmpeg', 'ffmpeg.exe');
    if (!existsSync(ffmpeg)) {
      this.lastError = `FFmpeg를 찾을 수 없습니다: ${ffmpeg}`;
      throw new Error(this.lastError);
    }

    const url = new URL(this.baseUrl);
    const child = spawn(python, ['-m', 'uvicorn', 'voice_service.main:app', '--host', url.hostname, '--port', url.port || '8000'], {
      cwd: this.serviceDirectory,
      env: { ...process.env, FFMPEG_BIN: ffmpeg },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    this.child = child;
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      const detail = chunk.trim();
      if (detail) this.lastError = detail;
    });
    child.on('error', (error) => {
      this.lastError = `음성 서비스 실행 실패: ${error.message}`;
      this.logger.error(this.lastError);
    });
    child.on('exit', (code) => {
      if (this.child === child) this.child = undefined;
      if (code && code !== 0) {
        this.lastError ??= `음성 서비스가 종료되었습니다. 종료 코드: ${code}`;
        this.logger.error(this.lastError);
      }
    });
    this.logger.info(`음성 서비스를 시작합니다: ${python}`);
  }

  private pythonExecutable(): string | undefined {
    const venvPython = resolve(
      this.serviceDirectory,
      '.venv',
      process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'
    );
    if (existsSync(venvPython)) return venvPython;
    return undefined;
  }

  private isLocalService(): boolean {
    const hostname = new URL(this.baseUrl).hostname;
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
  }

  private async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(1_000) });
      return response.ok;
    } catch {
      return false;
    }
  }
}