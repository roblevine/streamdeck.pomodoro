import type { ConfigSettings } from "./workflow";

export const DEFAULT_CONFIG: ConfigSettings = {
  workDuration: '00:10',
  shortBreakDuration: '00:02',
  longBreakDuration: '00:05',
  cyclesBeforeLongBreak: 4,
  pauseAtEndOfEachTimer: true,
  enableSound: undefined,
  workEndSoundPath: undefined,
  breakEndSoundPath: undefined,
  completionHoldSeconds: 2
};

