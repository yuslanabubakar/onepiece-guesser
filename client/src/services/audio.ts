// Den Den Trivia audio service using Web Audio API
// Custom simplified version for timer countdown ticking sounds only

let audioCtx: AudioContext | null = null;
let isMuted = false;

function getAudioContext(): AudioContext | null {
  if (isMuted) return null;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export const audioService = {
  setMuted(mute: boolean) {
    isMuted = mute;
    if (mute) {
      this.stopPurupuru();
    }
  },

  getMuted() {
    return isMuted;
  },

  // High-pitched short synthetic beep for timer ticks
  playTick() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, now); // 900Hz tone

    // Very fast decay for a sharp tick sound
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  },

  // Standard interface methods kept as no-ops to avoid breaking other calls
  playClick() {},
  playCorrect() {},
  playWrong() {},
  playPurupuru() {},
  stopPurupuru() {},
};
