import { CommandBase } from './command-base';
import { newId } from './id';
import { Id, Note, NoteColor } from './model';
import { readNote } from './read';
import { entity } from './schema';

export const GRID = 20;
export const snap = (v: number, grid = GRID): number => Math.round(v / grid) * grid;

/** Sticky notes and connectors. Positions are world coordinates (canvas pixels at zoom 1). */
export class WhiteboardCommands extends CommandBase {
  private maxZ(): number {
    let z = 0;
    for (const n of this.t.notes.values()) z = Math.max(z, Number(n.get('z')) || 0);
    return z;
  }

  addNote(input: Partial<Omit<Note, 'id' | 'z'>> & { x: number; y: number }): Id {
    const id = newId();
    return this.run('Added a sticky note', () => {
      this.t.notes.set(
        id,
        entity({ id, x: input.x, y: input.y, w: input.w ?? 200, h: input.h ?? 140, text: input.text ?? '', color: input.color ?? 'yellow', z: this.maxZ() + 1 }),
      );
      return id;
    });
  }

  /** Moves notes by a delta. With `grid`, snaps each note's top-left corner. */
  moveNotes(ids: readonly Id[], dx: number, dy: number, grid?: number): void {
    const label = ids.length > 1 ? `Moved ${ids.length} notes` : 'Moved a note';
    this.run(label, () => {
      for (const id of ids) {
        const n = this.t.notes.get(id);
        if (!n) continue;
        const note = readNote(n);
        const x = grid ? snap(note.x + dx, grid) : Math.round(note.x + dx);
        const y = grid ? snap(note.y + dy, grid) : Math.round(note.y + dy);
        if (x !== note.x) n.set('x', x);
        if (y !== note.y) n.set('y', y);
      }
    });
  }

  resizeNote(id: Id, w: number, h: number): void {
    const n = this.t.notes.get(id);
    if (!n) return;
    this.run('Resized a note', () => {
      n.set('w', Math.max(120, Math.round(w)));
      n.set('h', Math.max(80, Math.round(h)));
    });
  }

  setNoteText(id: Id, text: string): void {
    const n = this.t.notes.get(id);
    if (!n || n.get('text') === text) return;
    this.run('Edited a note', () => n.set('text', text));
  }

  setNoteColor(ids: readonly Id[], color: NoteColor): void {
    this.run('Recoloured notes', () => {
      for (const id of ids) this.t.notes.get(id)?.set('color', color);
    });
  }

  bringToFront(ids: readonly Id[]): void {
    const z = this.maxZ();
    const targets = ids.map((id) => this.t.notes.get(id)).filter((n) => n !== undefined);
    if (targets.every((n) => n.get('z') === z) && targets.length === 1) return;
    this.run('Brought notes to front', () => targets.forEach((n, i) => n.set('z', z + 1 + i)));
  }

  /** Deletes notes and every connector attached to them. */
  deleteNotes(ids: readonly Id[]): void {
    if (!ids.length) return;
    const set = new Set(ids);
    this.run(ids.length > 1 ? `Deleted ${ids.length} notes` : 'Deleted a note', () => {
      for (const id of ids) this.t.notes.delete(id);
      for (const [cid, c] of this.t.connectors) {
        if (set.has(c.get('from') as string) || set.has(c.get('to') as string)) this.t.connectors.delete(cid);
      }
    });
  }

  /** Connects two notes; ignores self-links and duplicates (in either direction). */
  connect(from: Id, to: Id): Id | null {
    if (from === to || !this.t.notes.has(from) || !this.t.notes.has(to)) return null;
    for (const c of this.t.connectors.values()) {
      const [a, b] = [c.get('from'), c.get('to')];
      if ((a === from && b === to) || (a === to && b === from)) return null;
    }
    const id = newId();
    this.run('Connected two notes', () => this.t.connectors.set(id, entity({ id, from, to })));
    return id;
  }

  deleteConnector(id: Id): void {
    if (!this.t.connectors.has(id)) return;
    this.run('Removed a connector', () => this.t.connectors.delete(id));
  }
}
