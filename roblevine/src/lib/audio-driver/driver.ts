import { WindowsPersistentDriver } from "./windows-persistent";
import { MacOsSystemDriver } from "./macos-system";

export interface AudioDriver {
  init(): Promise<void>;
  play(filePath: string): Promise<void>;
  stop(): void;
  dispose(): void;
}

export function createAudioDriver(): AudioDriver {
  const platform = process.platform;
  if (platform === 'win32') return new WindowsPersistentDriver();
  if (platform === 'darwin') return new MacOsSystemDriver();
  // Linux and others: reuse macOS-style per-play system command (aplay)
  return new MacOsSystemDriver('linux');
}

