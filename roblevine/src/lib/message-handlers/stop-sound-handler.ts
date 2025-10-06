/**
 * Handler for stop sound messages from Property Inspector
 */
import streamDeck from "@elgato/streamdeck";
import { AudioPlayer } from "../audio-player";
import { StopSoundMessage, PlaybackStoppedMessage } from "../../types/messages";
import { PluginMessageObserver } from "../plugin-message-observer";

export function handleStopSound(
	context: string,
	message: StopSoundMessage,
	messageObserver: PluginMessageObserver
): void {
	const { playbackId } = message.payload;

	streamDeck.logger.debug(`[StopSoundHandler] Stopping: ${playbackId}`);

	try {
		// Stop the audio player
		AudioPlayer.stop();

		streamDeck.logger.debug(`[StopSoundHandler] AudioPlayer.stop() called for: ${playbackId}`);

		// Notify PI that playback stopped
		const response: PlaybackStoppedMessage = {
			type: 'playbackStopped',
			payload: { playbackId }
		};
		messageObserver.sendToPropertyInspector(context, response);

		streamDeck.logger.debug(`[StopSoundHandler] Sent playbackStopped for: ${playbackId}`);
	} catch (error) {
		streamDeck.logger.error(`[StopSoundHandler] Failed to stop sound:`, error);

		// Still notify PI even if stop failed
		const errorResponse: PlaybackStoppedMessage = {
			type: 'playbackStopped',
			payload: { playbackId }
		};
		messageObserver.sendToPropertyInspector(context, errorResponse);
	}
}
