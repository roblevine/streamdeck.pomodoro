import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Cross-platform audio player
 */
export class AudioPlayer {
	/**
	 * Play a sound file (platform-specific implementation)
	 */
	static async play(filePath: string): Promise<void> {
		if (!filePath) {
			return;
		}

		try {
			if (process.platform === 'win32') {
				// Windows: use PowerShell's SoundPlayer
				const command = `powershell -c "(New-Object Media.SoundPlayer '${filePath}').PlaySync()"`;
				await execAsync(command);
			} else if (process.platform === 'darwin') {
				// macOS: use afplay
				await execAsync(`afplay "${filePath}"`);
			} else {
				// Linux: try aplay (ALSA), fallback to paplay (PulseAudio)
				try {
					await execAsync(`aplay "${filePath}"`);
				} catch {
					await execAsync(`paplay "${filePath}"`);
				}
			}
		} catch (error) {
			// Silently fail if audio playback fails
			console.error('Failed to play sound:', error);
		}
	}
}
