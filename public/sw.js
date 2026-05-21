// FinTrack AI Service Worker v2
const CACHE = 'fintrack-v2';

self.addEventListener('install', function() {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(e) {
  // API calls - network only (no caching)
  if (e.request.url.indexOf('/api/') !== -1) {
    return;
  }
  // Static assets - stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      var fetchPromise = fetch(e.request).then(function(response) {
        if (response && response.status === 200) {
          return caches.open(CACHE).then(function(cache) {
            cache.put(e.request, response.clone());
            return response;
          });
        }
        return response;
      }).catch(function() {
        return cached;
      });
      return cached || fetchPromise;
    })
  );
});
