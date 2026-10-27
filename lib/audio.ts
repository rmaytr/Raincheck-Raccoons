/** Tiny original synthesized cues. Call only from a user interaction or after sound opt-in. */
export type SoundType = "select" | "lock" | "reveal" | "win" | "bust" | "join";

let context: AudioContext | null = null;
let lastPlayedAt = 0;

export function playSound(type: SoundType, enabled: boolean): void {
  if (!enabled || typeof window === "undefined") return;
  // Never create or resume an audio device before a real user gesture.
  const activation = navigator.userActivation;
  if (activation && !activation.hasBeenActive) return;
  try {
    const AudioClass = window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioClass) return;
    const now = Date.now();
    if (now - lastPlayedAt < 65) return;
    lastPlayedAt = now;
    if (!context || context.state === "closed") {
      if (activation && !activation.isActive) return;
      context = new AudioClass();
    }
    const audio = context;
    const schedule = () => {
      if (audio.state !== "running") return;
      const notes: Record<SoundType, number[]> = {
        select: [523.25],
        lock: [392, 587.33],
        reveal: [261.63, 329.63, 392, 523.25],
        win: [523.25, 659.25, 783.99, 1046.5],
        bust: [233.08, 196, 174.61],
        join: [440, 659.25],
      };
      notes[type].forEach((frequency, index) => {
        const start = audio.currentTime + index * (type === "reveal" ? .095 : .075);
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = type === "bust" ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * .985, start + .2);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(type === "select" ? .035 : .045, start + .008);
        gain.gain.exponentialRampToValueAtTime(.0001, start + .25);
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start(start);
        oscillator.stop(start + .27);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
    };
    if (audio.state === "suspended") {
      if (activation && !activation.isActive) return;
      void audio.resume().then(schedule).catch(() => undefined);
    } else schedule();
  } catch {
    // Audio is enhancement-only: unsupported or blocked audio never interrupts a raid.
  }
}
