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
      
      const childRef = this.child;
      
      this.child.on('error', (e) => { 
        try { streamDeck.logger.error('[AudioMac/Linux] spawn error', e as any); } catch {} 
        // Clear reference on error so stop() doesn't try to kill it
        if (this.child === childRef) {
          this.child = null;
        }
      });
      
      // Wait for the process to complete
      return new Promise<void>((resolve, reject) => {
        if (!childRef) {
          resolve();
          return;
        }
        
        childRef.on('exit', (code, signal) => {
          // Clear reference when process exits
          if (this.child === childRef) {
            this.child = null;
          }
          
          if (code === 0 || signal === null) {
            // Normal exit
            resolve();
          } else {
            // Non-zero exit code or killed by signal
            // Still resolve (don't reject) since playback was attempted
            try { streamDeck.logger.debug(`[AudioMac/Linux] Process exited with code ${code}, signal ${signal}`); } catch {}
            resolve();
          }
        });
      });
    } catch (e) {
      try { streamDeck.logger.error('[AudioMac/Linux] failed to play', e as any); } catch {}
      // Re-throw so caller knows it failed
      throw e;
    }
  }

  stop(): void {
    if (this.child) {
      try {
        const pid = this.child.pid;
        const childRef = this.child;
        streamDeck.logger.debug(`[AudioMac/Linux] Stopping playback, PID: ${pid}`);
        
        // Clear reference immediately to prevent double-stop
        this.child = null;
        
        // Try SIGTERM first (graceful), then SIGKILL if needed
        try {
          childRef.kill('SIGTERM');
          // Give it a brief moment to exit gracefully, then force kill if still running
          if (pid !== undefined) {
            setTimeout(() => {
              try {
                // Check if process is still alive by attempting to send signal (will throw if dead)
                process.kill(pid, 0); // Signal 0 doesn't kill, just checks if process exists
                streamDeck.logger.debug(`[AudioMac/Linux] Process still running, force killing with SIGKILL`);
                process.kill(pid, 'SIGKILL');
              } catch (e) {
                // Process already dead, which is fine
                streamDeck.logger.debug(`[AudioMac/Linux] Process already terminated`);
              }
            }, 100);
          }
        } catch (e) {
          // If SIGTERM fails, try SIGKILL immediately
          try { 
            childRef.kill('SIGKILL');
            // Fallback: use process.kill if child.kill didn't work
            if (pid !== undefined) {
              try { process.kill(pid, 'SIGKILL'); } catch {}
            }
          } catch {}
        }
        
        streamDeck.logger.debug(`[AudioMac/Linux] Stop command completed`);
      } catch (error) {
        streamDeck.logger.error(`[AudioMac/Linux] Error stopping playback:`, error);
        this.child = null;
      }
    } else {
      streamDeck.logger.debug(`[AudioMac/Linux] stop() called but no child process exists`);
    }
  }

  dispose(): void {
    this.stop();
  }
}

