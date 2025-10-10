/**
 * Message types for Property Inspector <-> Plugin communication
 */

// Base message structure
export interface Message<T = unknown> {
	type: string;
	payload: T;
}

// ============================================================================
// Property Inspector → Plugin Messages
// ============================================================================

export interface PreviewSoundMessage {
	type: 'previewSound';
	payload: {
		filePath: string;
		playbackId: string;
	};
}

export interface StopSoundMessage {
	type: 'stopSound';
	payload: {
		playbackId: string;
	};
}

// Union type for all PI → Plugin messages
export type PropertyInspectorMessage =
	| PreviewSoundMessage
	| StopSoundMessage;

// ============================================================================
// Plugin → Property Inspector Messages
// ============================================================================

export interface PlaybackStartedMessage {
	type: 'playbackStarted';
	payload: {
		playbackId: string;
	};
}

export interface PlaybackStoppedMessage {
	type: 'playbackStopped';
	payload: {
		playbackId: string;
	};
}

// Union type for all Plugin → PI messages
export type PluginMessage =
	| PlaybackStartedMessage
	| PlaybackStoppedMessage;

// ============================================================================
// Type Guards
// ============================================================================

export function isPreviewSoundMessage(msg: Message): msg is PreviewSoundMessage {
	return msg.type === 'previewSound';
}

export function isStopSoundMessage(msg: Message): msg is StopSoundMessage {
	return msg.type === 'stopSound';
}

export function isPlaybackStartedMessage(msg: Message): msg is PlaybackStartedMessage {
	return msg.type === 'playbackStarted';
}

export function isPlaybackStoppedMessage(msg: Message): msg is PlaybackStoppedMessage {
	return msg.type === 'playbackStopped';
}
