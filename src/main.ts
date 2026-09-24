import { isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));

// Offline app shell (public/sw.js). Relative URL → registered under whatever sub-path we are served from.
if ('serviceWorker' in navigator && !isDevMode()) {
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker registration failed', err));
}
