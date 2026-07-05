// i18n entry for server code (server/resources.ts, server/weather.ts).
//
// Registers ONLY the server catalog so the esbuild server bundle doesn't carry
// the UI/narrative text. Two very different runtimes import this:
//
// - The solo desktop/web build: server/resources.ts is imported straight into
//   the renderer's module graph (src/solo/backend.ts), so this `core` is the
//   SAME instance the UI uses — when the player switches language, server
//   messages (errors, etc.) switch with it, for free.
// - The hosted Harper bundle (resources.js): its own copy of core, locale
//   stays 'en'. Hosted co-op error text is English until a per-request locale
//   is plumbed through — an accepted v1 limitation (v1 ships solo-only).

import serverEn from './en/server.json';
import { registerCatalog, t } from './core';

registerCatalog('en', { server: serverEn });

export { t };
