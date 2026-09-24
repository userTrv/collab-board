import { Injectable, signal } from '@angular/core';

export interface P2PSettings {
  readonly enabled: boolean;
  /** WebSocket signaling server for y-webrtc, e.g. wss://signaling.example.com */
  readonly signalingUrl: string;
  /** Optional room password: y-webrtc encrypts signaling and data with it. */
  readonly password: string;
}

const KEY = 'cb.p2p';
const DEFAULTS: P2PSettings = { enabled: false, signalingUrl: '', password: '' };

export function isValidSignalingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'wss:' || u.protocol === 'ws:';
  } catch {
    return false;
  }
}

/** Experimental cross-device sync settings. Off by default; nothing depends on it. */
@Injectable({ providedIn: 'root' })
export class P2PSettingsService {
  readonly settings = signal<P2PSettings>(this.load());

  save(next: P2PSettings): void {
    this.settings.set(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  private load(): P2PSettings {
    try {
      return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<P2PSettings>) };
    } catch {
      return DEFAULTS;
    }
  }
}
