import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { PomodoroTimer } from "./actions/pomodoro-timer";

// Set a reasonable default log level for ongoing use
streamDeck.logger.setLevel(LogLevel.INFO);

// Register the Pomodoro timer action.
streamDeck.actions.registerAction(new PomodoroTimer());

// Finally, connect to the Stream Deck.
streamDeck.connect();
