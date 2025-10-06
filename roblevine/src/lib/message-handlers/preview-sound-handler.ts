/**
 * Handler for preview sound messages from Property Inspector
 */
import streamDeck from "@elgato/streamdeck";
import { AudioPlayer } from "../audio-player";
import { PreviewSoundMessage, PlaybackStartedMessage } from "../../types/messages";
import { PluginMessageObserver } from "../plugin-message-observer";

export async function handlePreviewSound(
	context: string,
	message: PreviewSoundMessage,
	messageObserver: PluginMessageObserver
): Promise<void> {
	const { filePath, playbackId } = message.payload;

	streamDeck.logger.debug(`[PreviewSoundHandler] Playing: ${playbackId}, file: ${filePath}`);

	try {
		// Notify PI that playback started
		const startResponse: PlaybackStartedMessage = {
			type: 'playbackStarted',
			payload: { playbackId }
		};
		messageObserver.sendToPropertyInspector(context, startResponse);

		streamDeck.logger.debug(`[PreviewSoundHandler] Sent playbackStarted for: ${playbackId}`);

		// Play the audio (this will block until complete)
		await AudioPlayer.play(filePath, playbackId);

		streamDeck.logger.debug(`[PreviewSoundHandler] Playback completed: ${playbackId}`);

		// Notify PI that playback stopped (completed naturally)
		const stopResponse = {
			type: 'playbackStopped',
			payload: { playbackId }
		};
		messageObserver.sendToPropertyInspector(context, stopResponse);

		streamDeck.logger.debug(`[PreviewSoundHandler] Sent playbackStopped for: ${playbackId}`);
	} catch (error) {
		streamDeck.logger.error(`[PreviewSoundHandler] Failed to play sound:`, error);

		// Notify PI that playback stopped due to error
		const errorResponse = {
			type: 'playbackStopped',
			payload: { playbackId }
		};
		messageObserver.sendToPropertyInspector(context, errorResponse);
	}
}
