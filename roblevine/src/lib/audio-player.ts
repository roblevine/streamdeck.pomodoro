import { exec, ChildProcess } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Cross-platform audio player with stop functionality
 */
export class AudioPlayer {
	private static currentProcess: ChildProcess | null = null;
	private static currentPlaybackId: string | null = null;

	/**
	 * Play a sound file (platform-specific implementation)
	 * Returns a playback ID that can be used to stop the playback
	 */
	static async play(filePath: string, playbackId: string): Promise<void> {
		if (!filePath) {
			return;
		}

		// Stop any currently playing audio
		this.stop();

		this.currentPlaybackId = playbackId;

		try {
			let command: string;
			if (process.platform === 'win32') {
				// Windows: use PowerShell's SoundPlayer
				command = `powershell -c "(New-Object Media.SoundPlayer '${filePath}').PlaySync()"`;
			} else if (process.platform === 'darwin') {
				// macOS: use afplay
				command = `afplay "${filePath}"`;
			} else {
				// Linux: try aplay (ALSA), fallback to paplay (PulseAudio)
				command = `aplay "${filePath}"`;
			}

			this.currentProcess = exec(command);

			// Wait for process to complete
			await new Promise<void>((resolve, reject) => {
				this.currentProcess!.on('exit', (code) => {
					if (this.currentPlaybackId === playbackId) {
						this.currentProcess = null;
						this.currentPlaybackId = null;
					}
					if (code === 0 || code === null) {
						resolve();
					} else {
						reject(new Error(`Process exited with code ${code}`));
					}
				});

				this.currentProcess!.on('error', (error) => {
					if (this.currentPlaybackId === playbackId) {
						this.currentProcess = null;
						this.currentPlaybackId = null;
					}
					reject(error);
				});
			});
		} catch (error) {
			// Silently fail if audio playback fails
			console.error('Failed to play sound:', error);
			if (this.currentPlaybackId === playbackId) {
				this.currentProcess = null;
				this.currentPlaybackId = null;
			}
		}
	}

	/**
	 * Stop the currently playing audio
	 */
	static stop(): void {
		if (this.currentProcess) {
			this.currentProcess.kill();
			this.currentProcess = null;
			this.currentPlaybackId = null;
		}
	}

	/**
	 * Check if audio is currently playing
	 */
	static isPlaying(playbackId?: string): boolean {
		if (playbackId) {
			return this.currentPlaybackId === playbackId;
		}
		return this.currentProcess !== null;
	}
}
