// 최저가 레이더 – 오프라인에서도 앱 화면이 열리도록 기본 파일만 보관
const CACHE = 'lowradar-v1';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
// 같은 사이트의 파일만: 새 버전 우선, 안 되면 보관본
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request.url.split('?')[0], copy));
      return r;
    }).catch(() => caches.match(e.request.url.split('?')[0]).then(r => r || caches.match('./')))
  );
});
