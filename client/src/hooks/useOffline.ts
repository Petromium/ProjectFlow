/**
 * Offline Detection Hook
 * Monitors online/offline status and provides utilities for offline-aware components
 */

import { useState, useEffect } from 'react';

interface OfflineStatus {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnlineTime: number | null;
  lastOfflineTime: number | null;
}

export function useOffline(): OfflineStatus & {
  syncWhenOnline: () => Promise<void>;
} {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [lastOnlineTime, setLastOnlineTime] = useState<number | null>(
    navigator.onLine ? Date.now() : null
  );
  const [lastOfflineTime, setLastOfflineTime] = useState<number | null>(
    navigator.onLine ? null : Date.now()
  );

  useEffect(() => {
    const handleOnline = () => {
      console.log('[Offline] Connection restored');
      setIsOnline(true);
      setWasOffline(true);
      setLastOnlineTime(Date.now());
      
      // Trigger sync when coming back online
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SYNC_REQUEST',
        });
      }
    };

    const handleOffline = () => {
      console.log('[Offline] Connection lost');
      setIsOnline(false);
      setLastOfflineTime(Date.now());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncWhenOnline = async () => {
    if (!isOnline) {
      console.log('[Offline] Cannot sync - currently offline');
      return;
    }

    try {
      // Import sync function dynamically to avoid circular dependencies
      const { syncOfflineActions } = await import('@/lib/backgroundSync');
      await syncOfflineActions();
      setWasOffline(false);
    } catch (error) {
      console.error('[Offline] Failed to sync:', error);
    }
  };

  return {
    isOnline,
    wasOffline,
    lastOnlineTime,
    lastOfflineTime,
    syncWhenOnline,
  };
}

