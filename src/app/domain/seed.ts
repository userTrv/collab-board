import { newId } from './id';
import { BoardContent, Card, Column, Connector, Note } from './model';
import { spreadRanks } from './rank';

const day = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

type CardSeed = Pick<Card, 'title'> & Partial<Pick<Card, 'description' | 'labels' | 'assigneeId'>> & {
  dueInDays?: number;
  checklist?: [string, boolean][];
  comments?: [string, string, string][];
};

/** The demo board created on first run. Deterministic apart from ids and dates relative to `now`. */
export function demoBoard(now = Date.now()): BoardContent {
  const columnSeeds: [string, number | null, CardSeed[]][] = [
    ['Backlog', null, [
      { title: 'Dark mode for the mobile app', labels: ['feature', 'design'], assigneeId: 'margaret' },
      { title: 'Investigate flaky e2e test on Safari', labels: ['bug', 'research'] },
      { title: 'Collect feedback from beta users', labels: ['research'], assigneeId: 'alan', dueInDays: 12 },
    ]],
    ['To do', null, [
      { title: 'Write migration guide for v2', labels: ['chore'], assigneeId: 'grace', dueInDays: 6,
        description: 'Cover **breaking changes**, the new config format and a short FAQ.\n\n- config: `sync.mode` replaces `offline: true`\n- remove deprecated `board.legacyId`',
        checklist: [['Breaking changes table', false], ['Config examples', false], ['Review with support', false]] },
      { title: 'Keyboard shortcuts cheat sheet', labels: ['design'], assigneeId: 'barbara' },
      { title: 'Rate-limit the import endpoint', labels: ['urgent'], dueInDays: 2 },
    ]],
    ['In progress', 3, [
      { title: 'Offline-first sync for boards', labels: ['feature'], assigneeId: 'ada', dueInDays: 4,
        description: 'Yjs doc per board, persisted to IndexedDB, synced across tabs with BroadcastChannel.\n\nOpen this board in a **second tab** and edit — changes merge live.',
        checklist: [['Y.Doc per board', true], ['IndexedDB persistence', true], ['Cross-tab sync', true], ['Presence & cursors', false]],
        comments: [['Grace Hopper', '#0891b2', 'Tried it in two windows — cursors are fun.'], ['Ada Lovelace', '#7c3aed', 'Next: undo that only reverts my own edits.']] },
      { title: 'Login fails with SSO on Firefox', labels: ['bug', 'urgent'], assigneeId: 'linus', dueInDays: 1,
        checklist: [['Reproduce', true], ['Find root cause', false]] },
    ]],
    ['Review', 2, [
      { title: 'Redesign card detail dialog', labels: ['design'], assigneeId: 'margaret', dueInDays: 3,
        comments: [['Alan Turing', '#16a34a', 'Looks great, a bit tight on mobile.']] },
    ]],
    ['Done', null, [
      { title: 'Set up CI with lint, tests and build', labels: ['chore'], assigneeId: 'linus',
        checklist: [['Lint', true], ['Unit tests', true], ['Build', true]] },
      { title: 'Choose a CRDT library', labels: ['research'], assigneeId: 'ada',
        description: 'Compared Yjs and Automerge. Picked **Yjs**: small, fast, mature providers (IndexedDB, WebRTC) and a built-in UndoManager.' },
    ]],
  ];

  const colRanks = spreadRanks(columnSeeds.length);
  const columns: Column[] = [];
  const cards: Card[] = [];
  columnSeeds.forEach(([title, wipLimit, seeds], ci) => {
    const column: Column = { id: newId(), title, rank: colRanks[ci], wipLimit };
    columns.push(column);
    const ranks = spreadRanks(seeds.length);
    seeds.forEach((s, i) => {
      cards.push({
        id: newId(),
        columnId: column.id,
        rank: ranks[i],
        title: s.title,
        description: s.description ?? '',
        labels: s.labels ?? [],
        assigneeId: s.assigneeId ?? null,
        due: s.dueInDays !== undefined ? iso(now + s.dueInDays * day) : null,
        checklist: (s.checklist ?? []).map(([text, done]) => ({ id: newId(), text, done })),
        comments: (s.comments ?? []).map(([author, color, text], k) => ({ id: newId(), author, color, text, createdAt: now - (k + 1) * 3_600_000 })),
        createdAt: now - (ci + i + 1) * day,
      });
    });
  });

  const noteSeeds: [number, number, string, Note['color']][] = [
    [80, 80, 'Goal: ship v2 with offline mode by end of October', 'yellow'],
    [400, 40, 'Every edit is a CRDT op — no server needed to merge', 'blue'],
    [400, 240, 'Tabs sync via BroadcastChannel', 'green'],
    [720, 140, 'Risk: public WebRTC signaling is unreliable → keep it opt-in', 'pink'],
    [80, 320, 'Try it: drag notes, shift-click to multi-select, drag the ● handle to connect', 'purple'],
  ];
  const notes: Note[] = noteSeeds.map(([x, y, text, color], i) => ({ id: newId(), x, y, w: 220, h: 140, text, color, z: i + 1 }));
  const link = (a: number, b: number): Connector => ({ id: newId(), from: notes[a].id, to: notes[b].id });
  return {
    title: 'Product launch',
    columns,
    cards,
    notes,
    connectors: [link(0, 1), link(1, 2), link(1, 3)],
  };
}

const WORDS = ['Refactor', 'Fix', 'Design', 'Test', 'Document', 'Profile', 'Migrate', 'Review', 'Ship', 'Prototype'];
const THINGS = ['sync engine', 'login form', 'card dialog', 'drag & drop', 'undo stack', 'export', 'presence', 'history slider', 'settings', 'onboarding'];

/** A board with `count` cards spread over 5 columns — used to measure rendering performance. */
export function stressBoard(count = 1000, now = Date.now()): BoardContent {
  const titles = ['Backlog', 'To do', 'In progress', 'Review', 'Done'];
  const colRanks = spreadRanks(titles.length);
  const columns: Column[] = titles.map((title, i) => ({ id: newId(), title, rank: colRanks[i], wipLimit: null }));
  const perColumn = Math.ceil(count / columns.length);
  const ranks = spreadRanks(perColumn);
  const labels = ['bug', 'feature', 'design', 'research', 'chore', 'urgent'];
  const team = ['ada', 'grace', 'linus', 'margaret', 'alan', 'barbara', null];
  const cards: Card[] = Array.from({ length: count }, (_, i) => ({
    id: newId(),
    columnId: columns[i % columns.length].id,
    rank: ranks[Math.floor(i / columns.length)],
    title: `${WORDS[i % WORDS.length]} ${THINGS[(i * 7) % THINGS.length]} #${i + 1}`,
    description: '',
    labels: i % 3 === 0 ? [labels[i % labels.length]] : [],
    assigneeId: team[i % team.length],
    due: i % 5 === 0 ? iso(now + ((i % 20) - 5) * day) : null,
    checklist: i % 4 === 0 ? [{ id: newId(), text: 'Step one', done: true }, { id: newId(), text: 'Step two', done: false }] : [],
    comments: [],
    createdAt: now,
  }));
  return { title: `Stress test · ${count.toLocaleString('en-US')} cards`, columns, cards, notes: [], connectors: [] };
}
