import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[SW] Service Worker registered:', registration.scope);

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // Check every hour

        // Handle updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available, prompt user to reload
                console.log('[SW] New service worker available');
                if (confirm('A new version is available. Reload to update?')) {
                  window.location.reload();
                }
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('[SW] Service Worker registration failed:', error);
      });
  });

  // Listen for messages from service worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SYNC_COMPLETE') {
      console.log('[SW] Background sync completed');
    }
  });
}

// Initialize IndexedDB
import('./lib/indexeddb').then(({ initIndexedDB, cleanupExpiredCache }) => {
  initIndexedDB()
    .then(() => {
      console.log('[IndexedDB] Initialized');
      // Clean up expired cache on startup
      cleanupExpiredCache();
    })
    .catch((error) => {
      console.error('[IndexedDB] Initialization failed:', error);
    });
});

createRoot(document.getElementById("root")!).render(<App />);
