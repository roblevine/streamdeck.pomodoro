import streamDeck, { LogLevel } from "@elgato/streamdeck";
import { AudioPlayer } from "./lib/audio-player";

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
