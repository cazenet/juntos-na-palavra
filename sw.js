const C='juntos-v2';
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(C);await cache.addAll(['./','./index.html','./style.css','./app.js','./manifest.webmanifest']);await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key!==C).map(key=>caches.delete(key)));await self.clients.claim();})()));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith((async()=>{const cached=await caches.match(event.request);if(cached)return cached;return fetch(event.request);})());});
