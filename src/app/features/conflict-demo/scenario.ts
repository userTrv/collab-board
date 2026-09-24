import { BoardContent } from '../../domain/model';
import { BoardCommands } from '../../domain/board-commands';
import { spreadRanks } from '../../domain/rank';

export const NOTES_CARD = 'release-notes';

export function demoBase(): BoardContent {
  const colRanks = spreadRanks(3);
  const columns = [
    { id: 'todo', title: 'To do', rank: colRanks[0], wipLimit: null },
    { id: 'doing', title: 'Doing', rank: colRanks[1], wipLimit: null },
    { id: 'done', title: 'Done', rank: colRanks[2], wipLimit: null },
  ];
  const cards: [string, string, string][] = [
    ['docs', 'todo', 'Write docs'],
    ['login', 'todo', 'Fix login bug'],
    ['review', 'todo', 'Design review'],
    [NOTES_CARD, 'doing', 'Release notes'],
    ['deps', 'done', 'Update dependencies'],
  ];
  const ranks = spreadRanks(cards.length);
  return {
    title: 'Conflict demo',
    columns,
    cards: cards.map(([id, columnId, title], i) => ({
      id,
      columnId,
      rank: ranks[i],
      title,
      description: id === NOTES_CARD ? 'v2 ships offline mode.' : '',
      labels: [],
      assigneeId: null,
      due: null,
      checklist: [],
      comments: [],
      createdAt: 0,
    })),
    notes: [],
    connectors: [],
  };
}

export interface ScenarioStep {
  readonly replica: 'A' | 'B';
  readonly text: string;
  readonly run: (kanban: BoardCommands) => void;
}

/** Conflicting offline edits, one of each kind the CRDT has to resolve. */
export const SCENARIO: readonly ScenarioStep[] = [
  { replica: 'A', text: 'A renames “Write docs” → “Write API docs”', run: (k) => k.updateCard('docs', { title: 'Write API docs' }) },
  { replica: 'B', text: 'B renames the same card → “Write user guide”', run: (k) => k.updateCard('docs', { title: 'Write user guide' }) },
  { replica: 'A', text: 'A moves “Fix login bug” to Done', run: (k) => k.moveCard('login', 'done', 0) },
  { replica: 'B', text: 'B deletes “Fix login bug”', run: (k) => k.deleteCard('login') },
  { replica: 'A', text: 'A moves “Design review” to Doing', run: (k) => k.moveCard('review', 'doing', 0) },
  { replica: 'B', text: 'B moves “Design review” to Done', run: (k) => k.moveCard('review', 'done', 0) },
  { replica: 'A', text: 'A adds “Add dark mode” at the top of To do', run: (k) => k.addCard('todo', { title: 'Add dark mode' }, 0) },
  { replica: 'B', text: 'B adds “Add CSV export” at the top of To do', run: (k) => k.addCard('todo', { title: 'Add CSV export' }, 0) },
  { replica: 'A', text: 'A appends “ Faster sync.” to the release notes', run: (k) => appendText(k, ' Faster sync.') },
  { replica: 'B', text: 'B prepends “Draft: ” to the release notes', run: (k) => k.descriptionText(NOTES_CARD)?.insert(0, 'Draft: ') },
];

function appendText(k: BoardCommands, text: string): void {
  const t = k.descriptionText(NOTES_CARD);
  if (t) t.insert(t.length, text);
}
