import type { ConfigSettings } from "./workflow";

export const DEFAULT_CONFIG: ConfigSettings = {
  workDuration: '25:00',
  shortBreakDuration: '05:00',
  longBreakDuration: '10:00',
  cyclesBeforeLongBreak: 4,
  pauseAtEndOfEachTimer: true,
  enableSound: false,
  workEndSoundPath: undefined,
  breakEndSoundPath: undefined,
  completionHoldSeconds: 3
};
