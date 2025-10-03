self.addEventListener('install', e=>self.skipWaiting());
self.addEventListener('activate', e=>self.clients.claim());
// Placeholder for future scheduled notifications logic.
