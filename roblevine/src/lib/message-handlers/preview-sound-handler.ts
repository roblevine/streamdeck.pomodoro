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

    try {
        // Notify PI that playback started
        const startResponse: PlaybackStartedMessage = {
            type: 'playbackStarted',
            payload: { playbackId }
        };
        messageObserver.sendToPropertyInspector(context, startResponse);

        // Play the audio (this will block until complete)
        await AudioPlayer.play(filePath, playbackId);

        // Notify PI that playback stopped (completed naturally)
        const stopResponse = {
            type: 'playbackStopped',
            payload: { playbackId }
        };
        messageObserver.sendToPropertyInspector(context, stopResponse);
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
