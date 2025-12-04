/**
 * IndexedDB Service for PWA Offline Support
 * Provides 7-day data caching and offline action queueing
 */

const DB_NAME = 'GanttiumDB';
const DB_VERSION = 1;

// Store names
const STORES = {
  PROJECTS: 'projects',
  TASKS: 'tasks',
  RISKS: 'risks',
  ISSUES: 'issues',
  COST_ITEMS: 'costItems',
  STAKEHOLDERS: 'stakeholders',
  RESOURCES: 'resources',
  OFFLINE_QUEUE: 'offlineQueue',
  CACHE_METADATA: 'cacheMetadata',
} as const;

interface CacheMetadata {
  key: string;
  cachedAt: number;
  expiresAt: number;
}

interface OfflineAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: string;
  endpoint: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  data: any;
  timestamp: number;
  retries: number;
}

let db: IDBDatabase | null = null;

/**
 * Initialize IndexedDB database
 */
export async function initIndexedDB(): Promise<IDBDatabase> {
  if (db) {
    return db;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[IndexedDB] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log('[IndexedDB] Database opened successfully');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create object stores
      Object.values(STORES).forEach((storeName) => {
        if (!database.objectStoreNames.contains(storeName)) {
          const store = database.createObjectStore(storeName, { keyPath: 'id' });
          
          // Add indexes for common queries
          if (storeName === STORES.TASKS || storeName === STORES.PROJECTS) {
            store.createIndex('projectId', 'projectId', { unique: false });
          }
          if (storeName === STORES.OFFLINE_QUEUE) {
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('entityType', 'entityType', { unique: false });
          }
          if (storeName === STORES.CACHE_METADATA) {
            store.createIndex('expiresAt', 'expiresAt', { unique: false });
          }
        }
      });

      console.log('[IndexedDB] Database schema created/updated');
    };
  });
}

/**
 * Get database instance
 */
async function getDB(): Promise<IDBDatabase> {
  if (!db) {
    await initIndexedDB();
  }
  return db!;
}

/**
 * Cache data with expiration (7 days)
 */
export async function cacheData<T>(
  storeName: string,
  data: T & { id: string | number }
): Promise<void> {
  try {
    const database = await getDB();
    const transaction = database.transaction([storeName, STORES.CACHE_METADATA], 'readwrite');
    const store = transaction.objectStore(storeName);
    const metadataStore = transaction.objectStore(STORES.CACHE_METADATA);

    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    // Store data
    await new Promise<void>((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Store metadata
    const metadata: CacheMetadata = {
      key: `${storeName}:${data.id}`,
      cachedAt: Date.now(),
      expiresAt,
    };

    await new Promise<void>((resolve, reject) => {
      const request = metadataStore.put(metadata);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log(`[IndexedDB] Cached ${storeName}:${data.id}`);
  } catch (error) {
    console.error(`[IndexedDB] Failed to cache ${storeName}:`, error);
    throw error;
  }
}

/**
 * Get cached data
 */
export async function getCachedData<T>(
  storeName: string,
  id: string | number
): Promise<T | null> {
  try {
    const database = await getDB();
    const transaction = database.transaction([storeName, STORES.CACHE_METADATA], 'readonly');
    const store = transaction.objectStore(storeName);
    const metadataStore = transaction.objectStore(STORES.CACHE_METADATA);

    // Check if cache is expired
    const metadataKey = `${storeName}:${id}`;
    const metadata = await new Promise<CacheMetadata | null>((resolve, reject) => {
      const request = metadataStore.get(metadataKey);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });

    if (metadata && metadata.expiresAt < Date.now()) {
      // Cache expired, remove it
      await deleteCachedData(storeName, id);
      return null;
    }

    // Get data
    const data = await new Promise<T | null>((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });

    return data;
  } catch (error) {
    console.error(`[IndexedDB] Failed to get cached ${storeName}:`, error);
    return null;
  }
}

/**
 * Get all cached data for a store
 */
export async function getAllCachedData<T>(storeName: string): Promise<T[]> {
  try {
    const database = await getDB();
    const transaction = database.transaction([storeName, STORES.CACHE_METADATA], 'readonly');
    const store = transaction.objectStore(storeName);
    const metadataStore = transaction.objectStore(STORES.CACHE_METADATA);

    // Get all data
    const allData = await new Promise<T[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    // Filter expired items
    const validData: T[] = [];
    const now = Date.now();

    for (const item of allData) {
      const metadataKey = `${storeName}:${(item as any).id}`;
      const metadata = await new Promise<CacheMetadata | null>((resolve, reject) => {
        const request = metadataStore.get(metadataKey);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });

      if (!metadata || metadata.expiresAt >= now) {
        validData.push(item);
      } else {
        // Remove expired item
        await deleteCachedData(storeName, (item as any).id);
      }
    }

    return validData;
  } catch (error) {
    console.error(`[IndexedDB] Failed to get all cached ${storeName}:`, error);
    return [];
  }
}

/**
 * Delete cached data
 */
export async function deleteCachedData(
  storeName: string,
  id: string | number
): Promise<void> {
  try {
    const database = await getDB();
    const transaction = database.transaction([storeName, STORES.CACHE_METADATA], 'readwrite');
    const store = transaction.objectStore(storeName);
    const metadataStore = transaction.objectStore(STORES.CACHE_METADATA);

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const request = metadataStore.delete(`${storeName}:${id}`);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
    ]);

    console.log(`[IndexedDB] Deleted cached ${storeName}:${id}`);
  } catch (error) {
    console.error(`[IndexedDB] Failed to delete cached ${storeName}:`, error);
    throw error;
  }
}

/**
 * Clear all cached data for a store
 */
export async function clearCache(storeName: string): Promise<void> {
  try {
    const database = await getDB();
    const transaction = database.transaction([storeName, STORES.CACHE_METADATA], 'readwrite');
    const store = transaction.objectStore(storeName);
    const metadataStore = transaction.objectStore(STORES.CACHE_METADATA);

    // Get all keys to delete metadata
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Delete metadata
    await Promise.all(
      keys.map(
        (key) =>
          new Promise<void>((resolve, reject) => {
            const request = metadataStore.delete(`${storeName}:${key}`);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          })
      )
    );

    // Clear store
    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log(`[IndexedDB] Cleared cache for ${storeName}`);
  } catch (error) {
    console.error(`[IndexedDB] Failed to clear cache for ${storeName}:`, error);
    throw error;
  }
}

/**
 * Queue offline action for sync
 */
export async function queueOfflineAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retries'>): Promise<string> {
  try {
    const database = await getDB();
    const transaction = database.transaction([STORES.OFFLINE_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.OFFLINE_QUEUE);

    const offlineAction: OfflineAction = {
      id: `${action.entityType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retries: 0,
      ...action,
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.add(offlineAction);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log('[IndexedDB] Queued offline action:', offlineAction.id);
    return offlineAction.id;
  } catch (error) {
    console.error('[IndexedDB] Failed to queue offline action:', error);
    throw error;
  }
}

/**
 * Get all queued offline actions
 */
export async function getQueuedActions(): Promise<OfflineAction[]> {
  try {
    const database = await getDB();
    const transaction = database.transaction([STORES.OFFLINE_QUEUE], 'readonly');
    const store = transaction.objectStore(STORES.OFFLINE_QUEUE);
    const index = store.index('timestamp');

    return new Promise((resolve, reject) => {
      const request = index.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[IndexedDB] Failed to get queued actions:', error);
    return [];
  }
}

/**
 * Remove queued action (after successful sync)
 */
export async function removeQueuedAction(actionId: string): Promise<void> {
  try {
    const database = await getDB();
    const transaction = database.transaction([STORES.OFFLINE_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.OFFLINE_QUEUE);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(actionId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log('[IndexedDB] Removed queued action:', actionId);
  } catch (error) {
    console.error('[IndexedDB] Failed to remove queued action:', error);
    throw error;
  }
}

/**
 * Update retry count for queued action
 */
export async function updateQueuedActionRetry(actionId: string, retries: number): Promise<void> {
  try {
    const database = await getDB();
    const transaction = database.transaction([STORES.OFFLINE_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.OFFLINE_QUEUE);

    const action = await new Promise<OfflineAction | null>((resolve, reject) => {
      const request = store.get(actionId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });

    if (action) {
      action.retries = retries;
      await new Promise<void>((resolve, reject) => {
        const request = store.put(action);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  } catch (error) {
    console.error('[IndexedDB] Failed to update queued action retry:', error);
    throw error;
  }
}

/**
 * Clean up expired cache entries
 */
export async function cleanupExpiredCache(): Promise<void> {
  try {
    const database = await getDB();
    const transaction = database.transaction([STORES.CACHE_METADATA], 'readwrite');
    const metadataStore = transaction.objectStore(STORES.CACHE_METADATA);
    const index = metadataStore.index('expiresAt');

    const now = Date.now();
    const range = IDBKeyRange.upperBound(now);

    const expired = await new Promise<CacheMetadata[]>((resolve, reject) => {
      const request = index.getAll(range);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    // Delete expired metadata and corresponding data
    for (const metadata of expired) {
      const [storeName, id] = metadata.key.split(':');
      await deleteCachedData(storeName, id);
    }

    console.log(`[IndexedDB] Cleaned up ${expired.length} expired cache entries`);
  } catch (error) {
    console.error('[IndexedDB] Failed to cleanup expired cache:', error);
  }
}

// Export store names for use in other modules
export { STORES };

