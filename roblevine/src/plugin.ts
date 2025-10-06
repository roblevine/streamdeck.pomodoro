import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { PomodoroTimer } from "./actions/pomodoro-timer";

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel(LogLevel.DEBUG);

// Register the Pomodoro timer action.
streamDeck.actions.registerAction(new PomodoroTimer());

// Finally, connect to the Stream Deck.
streamDeck.connect();
