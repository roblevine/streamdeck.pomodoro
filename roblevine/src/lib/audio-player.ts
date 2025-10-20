import streamDeck from "@elgato/streamdeck";
import fs from "node:fs";
import { createAudioDriver, AudioDriver } from "./audio-driver/driver";

/**
 * AudioPlayer backed by Audic (ffplay). No fallback per project choice.
 */
export class AudioPlayer {
  private static driver: AudioDriver | null = null;
  private static currentPlaybackId: string | null = null;
  private static isCurrentlyPlaying = false;

  /**
   * Compute WAV duration (seconds) by parsing header. Best-effort; returns undefined on failure.
   */
  private static wavInfo(filePath: string): { durationSec?: number; channels?: number; sampleRate?: number; bitsPerSample?: number; dataOffset?: number; dataSize?: number } | undefined {
    try {
      const full = fs.readFileSync(filePath);
      const buf = full.subarray(0, Math.min(128, full.length));
      if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return undefined;
      // find 'fmt ' and 'data' chunks
      let offset = 12;
      let fmtFound = false;
      let channels = 2;
      let sampleRate = 44100;
      let bitsPerSample = 16;
      let dataSize: number | undefined;
      let dataOffset: number | undefined;
      while (offset + 8 <= full.length) {
        const id = full.toString('ascii', offset, offset + 4);
        const size = full.readUInt32LE(offset + 4);
        const chunkStart = offset + 8;
        if (id === 'fmt ') {
          fmtFound = true;
          channels = full.readUInt16LE(chunkStart + 2);
          sampleRate = full.readUInt32LE(chunkStart + 4);
          bitsPerSample = full.readUInt16LE(chunkStart + 14);
        } else if (id === 'data') {
          dataSize = size;
          dataOffset = chunkStart;
          break;
        }
        offset = chunkStart + size;
      }
      if (!fmtFound || !dataSize || channels <= 0 || sampleRate <= 0 || bitsPerSample <= 0 || dataOffset === undefined) return undefined;
      const bytesPerSample = (bitsPerSample / 8) * channels;
      if (bytesPerSample <= 0) return undefined;
      const duration = dataSize / (sampleRate * bytesPerSample);
      return { durationSec: duration, channels, sampleRate, bitsPerSample, dataOffset, dataSize };
    } catch {
      return undefined;
    }
  }

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
}
