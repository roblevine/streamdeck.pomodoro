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

// Type guards are unused in current plugin flow and have been removed to reduce surface area.
