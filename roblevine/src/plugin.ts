import streamDeck, { LogLevel } from "@elgato/streamdeck";
import { AudioPlayer } from "./lib/audio-player";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PomodoroTimer } from "./actions/pomodoro-timer";

// Temporarily set very verbose logging for debugging
streamDeck.logger.setLevel(LogLevel.DEBUG);

// Register the Pomodoro timer action.
streamDeck.actions.registerAction(new PomodoroTimer());

// Finally, connect to the Stream Deck.
streamDeck.connect();

// Gracefully dispose audio driver on shutdown
const disposeAudio = () => { try { AudioPlayer.dispose(); } catch {} };
process.on('exit', disposeAudio);
process.on('SIGINT', () => { disposeAudio(); process.exit(0); });
process.on('SIGTERM', () => { disposeAudio(); process.exit(0); });

// Prime the audio driver on startup to reduce initial playback latency (silent WAV)
try {
  const baseDir = path.dirname(fileURLToPath(import.meta.url));
  const primePath = path.resolve(baseDir, '..', 'assets', 'sounds', 'silent-prime.wav');
  setTimeout(() => { try { void AudioPlayer.play(primePath, 'prime'); } catch {} }, 0);
} catch {}
