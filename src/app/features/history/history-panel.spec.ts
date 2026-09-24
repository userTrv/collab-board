import { TestBed } from '@angular/core/testing';
import { HistoryEntry } from '../../data/history-recorder';
import { HistoryPanel } from './history-panel';

describe('HistoryPanel', () => {
  const entries: HistoryEntry[] = [
    { index: 0, ts: Date.UTC(2026, 8, 24, 10), by: 'System', color: '#666', label: 'Board created' },
    { index: 1, ts: Date.UTC(2026, 8, 24, 11), by: 'Ada', color: '#f00', label: 'Moved “X” to Done' },
  ];

  it('lists entries newest first and previews/restores the selected one', async () => {
    const fixture = TestBed.createComponent(HistoryPanel);
    fixture.componentRef.setInput('entries', entries);
    const restored: number[] = [];
    fixture.componentInstance.restore.subscribe((i) => restored.push(i));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const labels = [...el.querySelectorAll('.entry .label')].map((e) => e.textContent?.trim());
    expect(labels).toEqual(['Moved “X” to Done', 'Board created']);
    expect(el.textContent).toContain('Showing the live board');

    el.querySelectorAll<HTMLButtonElement>('.entry')[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.selected()).toBe(0);
    expect(el.textContent).toContain('read-only');

    [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Restore this version'))!.click();
    expect(restored).toEqual([0]);

    const slider = el.querySelector<HTMLInputElement>('input[type=range]')!;
    slider.value = '2';
    slider.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.selected()).toBeNull();
  });
});
