/**
 * Plain, immutable domain types. The Yjs document is the source of truth; these are the
 * projections the UI renders and the shapes used for JSON export/import.
 */
export type Id = string;

export type LabelColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';
export type NoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'purple';

export interface Label {
  readonly id: Id;
  readonly name: string;
  readonly color: LabelColor;
}

export interface Member {
  readonly id: Id;
  readonly name: string;
  readonly initials: string;
  readonly color: string;
}

export interface ChecklistItem {
  readonly id: Id;
  readonly text: string;
  readonly done: boolean;
}

export interface CardComment {
  readonly id: Id;
  readonly author: string;
  readonly color: string;
  readonly text: string;
  readonly createdAt: number;
}

export interface Column {
  readonly id: Id;
  readonly title: string;
  /** Fractional index, see rank.ts. Sorted by (rank, id). */
  readonly rank: string;
  readonly wipLimit: number | null;
}

export interface Card {
  readonly id: Id;
  readonly columnId: Id;
  readonly rank: string;
  readonly title: string;
  readonly description: string;
  readonly labels: readonly Id[];
  readonly assigneeId: Id | null;
  /** ISO date (yyyy-mm-dd) or null. */
  readonly due: string | null;
  readonly checklist: readonly ChecklistItem[];
  readonly comments: readonly CardComment[];
  readonly createdAt: number;
}

export interface Note {
  readonly id: Id;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly text: string;
  readonly color: NoteColor;
  readonly z: number;
}

export interface Connector {
  readonly id: Id;
  readonly from: Id;
  readonly to: Id;
}

export interface BoardContent {
  readonly title: string;
  readonly columns: readonly Column[];
  readonly cards: readonly Card[];
  readonly notes: readonly Note[];
  readonly connectors: readonly Connector[];
}

/** Summary kept in the workspace index document (one entry per board). */
export interface BoardSummary {
  readonly id: Id;
  readonly title: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly cardCount: number;
  readonly noteCount: number;
}

export interface CardPatch {
  title?: string;
  assigneeId?: Id | null;
  due?: string | null;
}
