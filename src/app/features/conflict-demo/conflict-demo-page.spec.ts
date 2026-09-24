import { TestBed } from '@angular/core/testing';
import { ConflictDemoPage } from './conflict-demo-page';

describe('ConflictDemoPage', () => {
  async function setup() {
    const fixture = TestBed.createComponent(ConflictDemoPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const button = (name: RegExp) => [...el.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''))!;
    const panels = () => [...el.querySelectorAll('app-replica-panel')];
    return { fixture, el, button, panels };
  }

  it('syncs live while online', async () => {
    const { fixture, el, panels } = await setup();
    const input = panels()[0].querySelector<HTMLInputElement>('input.add')!;
    input.value = 'Hello from A';
    input.form!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(panels()[1].textContent).toContain('Hello from A');
    expect(el.querySelector('.status')?.textContent).toContain('Converged');
  });

  it('diverges offline, then merges and explains the conflict on reconnect', async () => {
    const { fixture, el, button, panels } = await setup();
    button(/Go offline/).click();
    await fixture.whenStable();

    // Both replicas delete/rename the same card while offline.
    const deleteOn = (panel: Element, title: string) => panel.querySelector<HTMLButtonElement>(`button[aria-label="Delete ${title}"]`)!.click();
    const moveRight = (panel: Element, title: string) => panel.querySelector<HTMLButtonElement>(`button[aria-label="Move ${title} right"]`)!.click();
    moveRight(panels()[0], 'Fix login bug');
    deleteOn(panels()[1], 'Fix login bug');
    await fixture.whenStable();
    const board = (panel: Element) => panel.querySelector('.columns')?.textContent ?? '';
    expect(board(panels()[0])).toContain('Fix login bug');
    expect(board(panels()[1])).not.toContain('Fix login bug');
    expect(el.querySelector('.status')?.textContent).toContain('2 unsynced changes');

    button(/Reconnect/).click();
    await fixture.whenStable();
    expect(board(panels()[0])).not.toContain('Fix login bug');
    expect(el.querySelector('.status')?.textContent).toContain('Converged');
    const report = el.querySelector('.report')?.textContent ?? '';
    expect(report).toContain('delete wins');
    expect(report).toMatch(/A sent B \d+ bytes/);
  });
});
