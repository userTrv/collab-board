import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, RouteReuseStrategy, withComponentInputBinding, withHashLocation } from '@angular/router';
import { routes } from './app.routes';
import { BoardRouteReuseStrategy } from './core/ui/route-reuse';

/**
 * Zoneless (the Angular 21+ default — no zone.js in the bundle); signals drive change detection.
 * Hash routing: the app is served as static files from an unknown sub-path with no SPA
 * fallback, so every deep link must resolve to the same index.html.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withHashLocation(), withComponentInputBinding()),
    { provide: RouteReuseStrategy, useClass: BoardRouteReuseStrategy },
  ],
};
