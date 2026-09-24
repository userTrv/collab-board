import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', title: 'Boards · Collab Board', loadComponent: () => import('./features/boards/boards-page').then((m) => m.BoardsPage) },
  {
    path: 'b/:boardId',
    loadComponent: () => import('./features/board/board-page').then((m) => m.BoardPage),
    children: [
      { path: '', title: 'Board · Collab Board', loadComponent: () => import('./features/kanban/kanban-board').then((m) => m.KanbanBoard) },
      { path: 'whiteboard', title: 'Whiteboard · Collab Board', loadComponent: () => import('./features/whiteboard/whiteboard').then((m) => m.Whiteboard) },
    ],
  },
  { path: 'conflict-demo', title: 'Conflict demo · Collab Board', loadComponent: () => import('./features/conflict-demo/conflict-demo-page').then((m) => m.ConflictDemoPage) },
  { path: '**', redirectTo: '' },
];
