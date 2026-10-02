const CACHE='park-pilot-v3.0';
const CORE=['./','./index.html','./styles-v3.css','./app-v3.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-180.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const u=new URL(e.request.url);
  if(u.hostname==='api.themeparks.wiki'||u.hostname==='valhalla1.openstreetmap.de'){
    e.respondWith(fetch(e.request,{cache:'no-store'}));
    return;
  }
  // Network first so GitHub Pages updates show immediately; cache only as offline fallback.
  e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{if(u.origin===location.origin){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return r}).catch(()=>caches.match(e.request)));
});
