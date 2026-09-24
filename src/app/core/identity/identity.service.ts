import { Injectable, signal } from '@angular/core';

export interface Identity {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

const ADJECTIVES = ['Brave', 'Calm', 'Clever', 'Curious', 'Eager', 'Gentle', 'Happy', 'Jolly', 'Lucky', 'Nimble', 'Quiet', 'Swift', 'Witty', 'Bold', 'Sunny'];
const ANIMALS = ['Otter', 'Fox', 'Panda', 'Koala', 'Lynx', 'Heron', 'Badger', 'Falcon', 'Hedgehog', 'Dolphin', 'Owl', 'Puffin', 'Tiger', 'Walrus', 'Yak'];
export const PRESENCE_COLORS = ['#e11d48', '#ea580c', '#ca8a04', '#16a34a', '#0d9488', '#0284c7', '#4f46e5', '#9333ea', '#c026d3', '#db2777'];

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

export function randomIdentity(): Identity {
  return { id: Math.random().toString(36).slice(2, 10), name: `${pick(ADJECTIVES)} ${pick(ANIMALS)}`, color: pick(PRESENCE_COLORS) };
}

const KEY = 'cb.identity';

/**
 * Anonymous per-tab identity for presence (there are no accounts). Kept in sessionStorage so a
 * reload keeps the name, while a second tab gets its own — which is what makes the
 * multi-tab collaboration demo readable.
 */
@Injectable({ providedIn: 'root' })
export class IdentityService {
  private readonly state = signal<Identity>(this.load());
  readonly me = this.state.asReadonly();

  update(patch: Partial<Pick<Identity, 'name' | 'color'>>): void {
    const next = { ...this.state(), ...patch, name: (patch.name ?? this.state().name).trim().slice(0, 32) || this.state().name };
    this.state.set(next);
    try {
      sessionStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage may be unavailable (private mode) — identity stays in memory */
    }
  }

  private load(): Identity {
    try {
      const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Identity | null;
      if (saved?.id && saved.name && saved.color) return saved;
    } catch {
      /* ignore */
    }
    const fresh = randomIdentity();
    try {
      sessionStorage.setItem(KEY, JSON.stringify(fresh));
    } catch {
      /* ignore */
    }
    return fresh;
  }
}
