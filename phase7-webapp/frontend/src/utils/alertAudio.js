/**
 * LITHOS Web Audio API Alarm & Browser Notification Service
 * Self-contained: Works across all browsers with zero external audio assets.
 */

class AlertAudioService {
  constructor() {
    this.audioCtx = null;
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  playEmergencyChime() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Professional short double-ding notification
      const notes = [1046.50, 1318.51]; // C6, E6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine'; // Smooth, professional tone
        osc.frequency.setValueAtTime(freq, now + i * 0.15);
        
        gain.gain.setValueAtTime(0, now + i * 0.15);
        gain.gain.linearRampToValueAtTime(0.25, now + i * 0.15 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.35);
      });

      // Mobile device haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch (e) {
      console.warn("Audio alert error:", e);
    }
  }

  /**
   * Plays a success chime (Subscribed / Connected)
   */
  playSuccessTone() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);

        gain.gain.setValueAtTime(0.001, now + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.18, now + i * 0.12 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.28);
      });
    } catch (_) {}
  }
}

export const alertAudio = new AlertAudioService();

/**
 * Check or request Native Browser Notifications
 */
export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch (e) {
    console.warn("Notification permission error:", e);
    return Notification.permission;
  }
}

/**
 * Fires a genuine desktop/mobile OS system notification
 */
export function sendBrowserNotification(title, options = {}) {
  if (!("Notification" in window)) return false;

  if (Notification.permission === 'granted') {
    try {
      const n = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        requireInteraction: true,
        vibrate: [300, 100, 300],
        ...options
      });
      n.onclick = () => {
        window.focus();
        if (options.url) {
          window.location.href = options.url;
        }
      };
      return true;
    } catch (e) {
      console.warn("Native Notification error:", e);
      return false;
    }
  }
  return false;
}
