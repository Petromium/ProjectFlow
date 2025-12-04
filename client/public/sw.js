/**
 * Service Worker for ProjectFlow PMIS
 * Implements caching strategies for offline support (7-day requirement)
 */

const CACHE_NAME = 'projectflow-v1';
const STATIC_CACHE_NAME = 'projectflow-static-v1';
const API_CACHE_NAME = 'projectflow-api-v1';
const OFFLINE_DATA_CACHE_NAME = 'projectflow-data-v1';

// Cache duration: 7 days in milliseconds
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/favicon.png',
  '/manifest.json',
];

// API endpoints that should be cached
const CACHEABLE_API_PATTERNS = [
  /^\/api\/organizations$/,
  /^\/api\/organizations\/\d+\/projects$/,
  /^\/api\/projects\/\d+$/,
  /^\/api\/projects\/\d+\/tasks$/,
  /^\/api\/projects\/\d+\/risks$/,
  /^\/api\/projects\/\d+\/issues$/,
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // Force activation of new service worker
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // Remove old caches
              return name !== CACHE_NAME &&
                     name !== STATIC_CACHE_NAME &&
                     name !== API_CACHE_NAME &&
                     name !== OFFLINE_DATA_CACHE_NAME;
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (POST, PUT, DELETE go to network)
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    event.respondWith(fetch(request));
    return;
  }

  // Static assets: Cache-first strategy
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE_NAME));
    return;
  }

  // API requests: Network-first with cache fallback
  if (isAPIRequest(url.pathname)) {
    event.respondWith(networkFirstWithCache(request, API_CACHE_NAME));
    return;
  }

  // HTML pages: Network-first with cache fallback
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstWithCache(request, STATIC_CACHE_NAME));
    return;
  }

  // Default: Network-only
  event.respondWith(fetch(request));
});

/**
 * Check if URL is a static asset
 */
function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/assets/') ||
    pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/i)
  );
}

/**
 * Check if URL is an API request
 */
function isAPIRequest(pathname) {
  return pathname.startsWith('/api/');
}

/**
 * Cache-first strategy: Check cache first, fallback to network
 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached) {
    // Check if cache is still valid (within 7 days)
    const cachedDate = cached.headers.get('sw-cached-date');
    if (cachedDate) {
      const cacheAge = Date.now() - parseInt(cachedDate);
      if (cacheAge < CACHE_DURATION) {
        return cached;
      }
    } else {
      // No date header, assume valid
      return cached;
    }
  }

  // Not in cache or expired, fetch from network
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Clone response and add cache date header
      const responseToCache = response.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cached-date', Date.now().toString());
      
      const cachedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers,
      });
      
      cache.put(request, cachedResponse);
    }
    return response;
  } catch (error) {
    console.error('[SW] Cache-first fetch failed:', error);
    // Return cached version even if expired, if available
    if (cached) {
      return cached;
    }
    throw error;
  }
}

/**
 * Network-first with cache fallback strategy
 */
async function networkFirstWithCache(request, cacheName) {
  const cache = await caches.open(cacheName);
  
  try {
    // Try network first
    const response = await fetch(request);
    
    if (response.ok) {
      // Cache successful responses
      const responseToCache = response.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cached-date', Date.now().toString());
      
      const cachedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers,
      });
      
      cache.put(request, cachedResponse);
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Network request failed, trying cache:', error);
    
    // Network failed, try cache
    const cached = await cache.match(request);
    
    if (cached) {
      // Check if cache is still valid
      const cachedDate = cached.headers.get('sw-cached-date');
      if (cachedDate) {
        const cacheAge = Date.now() - parseInt(cachedDate);
        if (cacheAge < CACHE_DURATION) {
          return cached;
        }
      } else {
        // No date header, return cached version
        return cached;
      }
    }
    
    // No cache available, return offline response
    if (request.headers.get('accept')?.includes('text/html')) {
      return new Response(
        '<!DOCTYPE html><html><head><title>Offline</title></head><body><h1>You are offline</h1><p>Please check your connection and try again.</p></body></html>',
        {
          headers: { 'Content-Type': 'text/html' },
        }
      );
    }
    
    throw error;
  }
}

/**
 * Background sync for queued actions
 */
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-offline-actions') {
    event.waitUntil(syncOfflineActions());
  }
});

/**
 * Sync queued offline actions
 */
async function syncOfflineActions() {
  try {
    // Get queued actions from IndexedDB (handled by client code)
    // This is a placeholder - actual sync logic in client
    console.log('[SW] Syncing offline actions...');
    
    // Notify clients that sync is complete
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        timestamp: Date.now(),
      });
    });
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

/**
 * Push notification handler
 */
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'ProjectFlow Notification';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: data.tag || 'notification',
    data: data,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/**
 * Notification click handler
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  
  event.notification.close();
  
  const data = event.notification.data;
  const urlToOpen = data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

