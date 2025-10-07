import * as player from "node-wav-player";

/**
 * Cross-platform audio player with stop functionality
 */
export class AudioPlayer {
	private static currentPlaybackId: string | null = null;
	private static isCurrentlyPlaying: boolean = false;

	/**
	 * Play a sound file using node-wav-player
	 * Returns a playback ID that can be used to stop the playback
	 */
	static async play(filePath: string, playbackId: string): Promise<void> {
		if (!filePath) {
			return;
		}

		// Stop any currently playing audio
		this.stop();

		this.currentPlaybackId = playbackId;
		this.isCurrentlyPlaying = true;

		try {
			await player.play({
				path: filePath,
				sync: true
			});

			// Playback completed naturally
			if (this.currentPlaybackId === playbackId) {
				this.currentPlaybackId = null;
				this.isCurrentlyPlaying = false;
			}
		} catch (error) {
			// Silently fail if audio playback fails or was stopped
			console.error('Failed to play sound:', error);
			if (this.currentPlaybackId === playbackId) {
				this.currentPlaybackId = null;
				this.isCurrentlyPlaying = false;
			}
		}
	}

	/**
	 * Stop the currently playing audio
	 */
	static stop(): void {
		if (this.isCurrentlyPlaying) {
			player.stop();
			this.currentPlaybackId = null;
			this.isCurrentlyPlaying = false;
		}
	}

	/**
	 * Check if audio is currently playing
	 */
	static isPlaying(playbackId?: string): boolean {
		if (playbackId) {
			return this.currentPlaybackId === playbackId;
		}
		return this.isCurrentlyPlaying;
	}
}
