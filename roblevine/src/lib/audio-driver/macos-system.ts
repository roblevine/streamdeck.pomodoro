import { spawn, ChildProcess } from "node:child_process";
import streamDeck from "@elgato/streamdeck";
import { AudioDriver } from "./driver";

export class MacOsSystemDriver implements AudioDriver {
  private child: ChildProcess | null = null;
  private readonly platform: 'darwin' | 'linux';

  constructor(platform: 'darwin' | 'linux' = 'darwin') {
    this.platform = platform;
  }

  async init(): Promise<void> {
    // No-op for macOS/Linux simple drivers
  }

  async play(filePath: string): Promise<void> {
    this.stop();
    try {
      if (this.platform === 'darwin') {
        this.child = spawn('afplay', [filePath], { stdio: 'ignore' });
      } else {
        // Linux: try aplay; environment dependent
        this.child = spawn('aplay', [filePath], { stdio: 'ignore' });
      }
      this.child.on('error', (e) => { try { streamDeck.logger.error('[AudioMac/Linux] spawn error', e as any); } catch {} });
      this.child.on('exit', () => { this.child = null; });
    } catch (e) {
      try { streamDeck.logger.error('[AudioMac/Linux] failed to play', e as any); } catch {}
    }
  }

  stop(): void {
    if (this.child) {
      try { this.child.kill('SIGKILL'); } catch {}
      this.child = null;
    }
  }

  dispose(): void {
    this.stop();
  }
}

