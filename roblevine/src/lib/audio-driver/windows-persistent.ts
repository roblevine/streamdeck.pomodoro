import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import streamDeck from "@elgato/streamdeck";
import { AudioDriver } from "./driver";

export class WindowsPersistentDriver implements AudioDriver {
  private ps: ChildProcessWithoutNullStreams | null = null;
  private ready = false;
  private starting = false;

  private script(): string {
    // PowerShell script that keeps a SoundPlayer resident and accepts commands from stdin
    return `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System | Out-Null
$player = New-Object System.Media.SoundPlayer
[Console]::Out.WriteLine('READY')
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  if ($line.StartsWith('PLAYB64 ')) {
    try {
      $b64 = $line.Substring(8)
      $path = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b64))
      $player.Stop()
      $player.SoundLocation = $path
      $player.Load()
      $player.Play()
      [Console]::Out.WriteLine('OK')
    } catch {
      [Console]::Out.WriteLine('ERR ' + $_.Exception.Message)
    }
  } elseif ($line -eq 'STOP') {
    try { $player.Stop() } catch {}
    [Console]::Out.WriteLine('OK')
  } elseif ($line -eq 'EXIT') {
    break
  } else {
    [Console]::Out.WriteLine('IGN')
  }
}
`;
  }

  async init(): Promise<void> {
    if (this.ps || this.starting) return;
    this.starting = true;
    try {
      const ps = spawn('powershell.exe', ['-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-STA','-Command','-'], { stdio: ['pipe','pipe','pipe'] });
      this.ps = ps;
      ps.stdin.setDefaultEncoding('utf-8');
      ps.stdout.setEncoding('utf-8');
      ps.stderr.setEncoding('utf-8');
      ps.on('error', (e) => { try { streamDeck.logger.error('[AudioWin] ps error', e as any); } catch {} this.ready = false; });
      ps.on('exit', () => { this.ready = false; this.ps = null; });
      let resolved = false;
      await new Promise<void>((resolve) => {
        const onData = (d: string) => {
          if (!resolved && d.includes('READY')) {
            this.ready = true;
            resolved = true;
            ps.stdout.off('data', onData);
            resolve();
          }
        };
        ps.stdout.on('data', onData);
        try { ps.stdin.write(this.script() + "\n"); } catch {}
      });
    } finally {
      this.starting = false;
    }
  }

  async play(filePath: string): Promise<void> {
    if (!this.ps || !this.ready) await this.init();
    if (!this.ps || !this.ready) return;
    const b64 = Buffer.from(filePath, 'utf-8').toString('base64');
    try {
      this.ps.stdin.write(`PLAYB64 ${b64}\n`);
    } catch (e) {
      try { streamDeck.logger.error('[AudioWin] write failed', e as any); } catch {}
    }
  }

  stop(): void {
    if (!this.ps || !this.ready) return;
    try { this.ps.stdin.write('STOP\n'); } catch {}
  }

  dispose(): void {
    if (!this.ps) return;
    try { this.ps.stdin.write('EXIT\n'); } catch {}
    try { this.ps.kill(); } catch {}
    this.ps = null;
    this.ready = false;
  }
}
