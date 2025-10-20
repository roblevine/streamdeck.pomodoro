import streamDeck from "@elgato/streamdeck";
import fs from "node:fs";
import { createAudioDriver, AudioDriver } from "./audio-driver/driver";

/**
 * AudioPlayer using OS-specific drivers:
 * - Windows: persistent PowerShell host + System.Media.SoundPlayer
 * - macOS: afplay per play
 * - Linux: aplay per play
 */
export class AudioPlayer {
  private static driver: AudioDriver | null = null;
  private static currentPlaybackId: string | null = null;
  private static isCurrentlyPlaying = false;

  static async play(filePath: string, playbackId: string): Promise<void> {
    if (!filePath) return;
    try { if (!fs.existsSync(filePath)) return; } catch {}

    // Stop any currently playing audio
    this.stop();

    this.currentPlaybackId = playbackId;
    this.isCurrentlyPlaying = true;

    try {
      if (!this.driver) {
        this.driver = createAudioDriver();
        try { await this.driver.init(); } catch (e) { try { streamDeck.logger.error('[Audio] driver init failed', e as any); } catch {} }
      }
      await this.driver!.play(filePath);
      if (this.currentPlaybackId === playbackId) {
        this.currentPlaybackId = null;
        this.isCurrentlyPlaying = false;
      }
    } catch (error) {
      streamDeck.logger.error('Failed to play sound (driver):', error);
      if (this.currentPlaybackId === playbackId) {
        this.currentPlaybackId = null;
        this.isCurrentlyPlaying = false;
      }
    }
  }

  static stop(): void {
    try { this.driver?.stop(); } catch {}
    this.currentPlaybackId = null;
    this.isCurrentlyPlaying = false;
  }

  static dispose(): void {
    try { this.driver?.dispose(); } catch {}
    this.driver = null;
  }
}
