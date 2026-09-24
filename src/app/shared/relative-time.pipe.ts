import { Pipe, PipeTransform } from '@angular/core';

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];
const fmt = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function relativeTime(ts: number, now = Date.now()): string {
  const diff = ts - now;
  if (Math.abs(diff) < 45_000) return 'just now';
  for (const [unit, ms] of UNITS) if (Math.abs(diff) >= ms || unit === 'minute') return fmt.format(Math.round(diff / ms), unit);
  return '';
}

/** Pure pipe: re-evaluated when the timestamp changes (good enough for "updated 5 minutes ago"). */
@Pipe({ name: 'relativeTime' })
export class RelativeTimePipe implements PipeTransform {
  transform(ts: number): string {
    return relativeTime(ts);
  }
}
