import { Label, Member } from './model';

/** Fixed label palette shared by all boards (keeps the data model small). */
export const LABELS: readonly Label[] = [
  { id: 'bug', name: 'Bug', color: 'red' },
  { id: 'urgent', name: 'Urgent', color: 'orange' },
  { id: 'design', name: 'Design', color: 'purple' },
  { id: 'feature', name: 'Feature', color: 'blue' },
  { id: 'research', name: 'Research', color: 'yellow' },
  { id: 'chore', name: 'Chore', color: 'green' },
];

/** A fake local "team" for assignees — there are no accounts, this is a no-backend demo. */
export const TEAM: readonly Member[] = [
  { id: 'ada', name: 'Ada Lovelace', initials: 'AL', color: '#7c3aed' },
  { id: 'grace', name: 'Grace Hopper', initials: 'GH', color: '#0891b2' },
  { id: 'linus', name: 'Linus Torvalds', initials: 'LT', color: '#ca8a04' },
  { id: 'margaret', name: 'Margaret Hamilton', initials: 'MH', color: '#db2777' },
  { id: 'alan', name: 'Alan Turing', initials: 'AT', color: '#16a34a' },
  { id: 'barbara', name: 'Barbara Liskov', initials: 'BL', color: '#ea580c' },
];

export const labelById = (id: string): Label | undefined => LABELS.find((l) => l.id === id);
export const memberById = (id: string | null): Member | undefined => (id ? TEAM.find((m) => m.id === id) : undefined);
