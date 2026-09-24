import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { replica, smallBoard } from '../../../testing/crdt';
import { BoardStore } from '../../data/board-store';
import { BoardSession } from '../../data/board-session';
import { Peer } from '../../data/presence';
import { CardTile } from './card-tile';
import { KanbanActions } from './kanban-actions';

describe('CardTile', () => {
  function setup() {
    const r = replica();
    r.kanban.applyContent(smallBoard());
    r.kanban.updateCard('c1', { assigneeId: 'ada', due: '2000-01-01' });
    r.kanban.toggleLabel('c1', 'bug');
    r.kanban.addChecklistItem('c1', 'one');
    r.kanban.addChecklistItem('c1', 'two');
    const store = new BoardStore(r.doc);
    const editors = signal(new Map<string, Peer[]>());
    const actions = { editorsByCard: editors, open: vi.fn(), moveBy: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: BoardSession, useValue: { store } },
        { provide: KanbanActions, useValue: actions },
      ],
    });
    const fixture = TestBed.createComponent(CardTile);
    fixture.componentRef.setInput('cardId', 'c1');
    fixture.detectChanges();
    return { r, fixture, actions, editors, el: fixture.nativeElement as HTMLElement };
  }

  it('renders title, labels, checklist progress, overdue date and assignee', () => {
    const { el } = setup();
    expect(el.querySelector('.title')?.textContent).toContain('Card 1');
    expect(el.querySelector('.label-chip')?.textContent).toContain('Bug');
    expect(el.textContent).toContain('0/2');
    expect(el.querySelector('.due.overdue')?.textContent).toContain('Jan 1');
    expect(el.querySelector('app-avatar')?.getAttribute('aria-label')).toBe('Ada Lovelace');
    expect(el.getAttribute('aria-label')).toContain('due 2000-01-01 (overdue)');
  });

  it('re-renders when its card changes in the Y.Doc', async () => {
    const { r, fixture, el } = setup();
    r.kanban.updateCard('c1', { title: 'Renamed remotely' });
    await fixture.whenStable();
    expect(el.querySelector('.title')?.textContent).toContain('Renamed remotely');
  });

  it('opens on Enter and moves with Alt+arrows', () => {
    const { el, actions } = setup();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(actions.open).toHaveBeenCalledWith('c1');
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }));
    expect(actions.moveBy).toHaveBeenCalledWith('c1', 1, 0);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }));
    expect(actions.moveBy).toHaveBeenCalledWith('c1', 0, -1);
  });

  it('shows who else is editing the card', async () => {
    const { fixture, editors, el } = setup();
    const peer: Peer = { clientId: 7, user: { id: 'x', name: 'Swift Otter', color: '#e11d48' }, cursor: null, editing: 'c1', view: 'kanban' };
    editors.set(new Map([['c1', [peer]]]));
    await fixture.whenStable();
    expect(el.querySelector('.editing')?.textContent).toContain('Swift Otter is editing');
    expect(el.classList).toContain('being-edited');
  });
});
