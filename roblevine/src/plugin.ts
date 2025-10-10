import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { PomodoroTimer } from "./actions/pomodoro-timer";

// Temporarily set very verbose logging for debugging
streamDeck.logger.setLevel(LogLevel.DEBUG);

// Register the Pomodoro timer action.
streamDeck.actions.registerAction(new PomodoroTimer());

// Finally, connect to the Stream Deck.
streamDeck.connect();
