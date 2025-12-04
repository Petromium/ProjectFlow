/**
 * Background Sync Service
 * Handles syncing queued offline actions when connection is restored
 */

import {
  getQueuedActions,
  removeQueuedAction,
  updateQueuedActionRetry,
} from './indexeddb';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Sync all queued offline actions
 */
export async function syncOfflineActions(): Promise<void> {
  const queuedActions = await getQueuedActions();

  if (queuedActions.length === 0) {
    console.log('[BackgroundSync] No queued actions to sync');
    return;
  }

  console.log(`[BackgroundSync] Syncing ${queuedActions.length} queued actions...`);

  const results = await Promise.allSettled(
    queuedActions.map((action) => syncAction(action))
  );

  const successful = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  console.log(
    `[BackgroundSync] Sync complete: ${successful} successful, ${failed} failed`
  );

  // Notify user if there were failures
  if (failed > 0) {
    console.warn(`[BackgroundSync] ${failed} actions failed to sync`);
  }
}

/**
 * Sync a single offline action
 */
async function syncAction(action: {
  id: string;
  endpoint: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  data: any;
  retries: number;
}): Promise<void> {
  try {
    // Check retry limit
    if (action.retries >= MAX_RETRIES) {
      console.error(
        `[BackgroundSync] Action ${action.id} exceeded max retries, removing from queue`
      );
      await removeQueuedAction(action.id);
      return;
    }

    // Attempt sync using fetch directly to avoid circular dependency
    const response = await fetch(action.endpoint, {
      method: action.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action.data),
      credentials: 'include',
    });

    if (response.ok || response.status === 201 || response.status === 204) {
      // Success - remove from queue
      await removeQueuedAction(action.id);
      console.log(`[BackgroundSync] Successfully synced action ${action.id}`);
    } else {
      // Failed - increment retry count
      const newRetries = action.retries + 1;
      await updateQueuedActionRetry(action.id, newRetries);

      if (newRetries >= MAX_RETRIES) {
        console.error(
          `[BackgroundSync] Action ${action.id} failed after ${MAX_RETRIES} retries`
        );
        await removeQueuedAction(action.id);
      } else {
        // Retry with exponential backoff
        setTimeout(() => {
          syncAction({ ...action, retries: newRetries });
        }, RETRY_DELAY * Math.pow(2, newRetries));
      }
    }
  } catch (error) {
    console.error(`[BackgroundSync] Error syncing action ${action.id}:`, error);

    // Increment retry count
    const newRetries = action.retries + 1;
    await updateQueuedActionRetry(action.id, newRetries);

    if (newRetries < MAX_RETRIES) {
      // Retry with exponential backoff
      setTimeout(() => {
        syncAction({ ...action, retries: newRetries });
      }, RETRY_DELAY * Math.pow(2, newRetries));
    } else {
      // Max retries reached, remove from queue
      await removeQueuedAction(action.id);
    }
  }
}

/**
 * Register background sync (if supported)
 */
export async function registerBackgroundSync(): Promise<void> {
  if ('serviceWorker' in navigator && 'sync' in (self as any).registration) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await (registration as any).sync.register('sync-offline-actions');
      console.log('[BackgroundSync] Background sync registered');
    } catch (error) {
      console.warn('[BackgroundSync] Background sync not supported:', error);
    }
  }
}

