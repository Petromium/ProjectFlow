/**
 * Secret Manager Service
 * Provides secure secret management using Google Cloud Secret Manager
 * Falls back to environment variables if Secret Manager is not configured
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

let secretManagerClient: SecretManagerServiceClient | null = null;
let projectId: string | null = null;

// Cache for secrets to avoid repeated API calls
const secretCache = new Map<string, { value: string; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Initialize Secret Manager client
export function initializeSecretManager(): void {
  projectId = process.env.GOOGLE_PROJECT_ID || process.env.GCLOUD_PROJECT || null;
  
  // Only initialize in production if project ID is set
  if (process.env.NODE_ENV === 'production' && projectId) {
    try {
      secretManagerClient = new SecretManagerServiceClient();
      console.log(`[Secret Manager] Initialized for project: ${projectId}`);
    } catch (error) {
      console.error('[Secret Manager] Failed to initialize:', error);
      secretManagerClient = null;
    }
  }
}

/**
 * Get secret value from Secret Manager or environment variable
 */
export async function getSecret(secretName: string): Promise<string | null> {
  // Check cache first
  const cached = secretCache.get(secretName);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  // Fallback to environment variable if Secret Manager is not configured
  if (!secretManagerClient || !projectId) {
    const envValue = process.env[secretName];
    if (envValue) {
      return envValue;
    }
    // Try common naming conventions
    const envValueUpper = process.env[secretName.toUpperCase()];
    if (envValueUpper) {
      return envValueUpper;
    }
    return null;
  }

  try {
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
    const [version] = await secretManagerClient.accessSecretVersion({ name });
    
    if (!version.payload?.data) {
      return null;
    }

    const secretValue = version.payload.data.toString();
    
    // Cache the secret
    secretCache.set(secretName, {
      value: secretValue,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return secretValue;
  } catch (error: any) {
    // If secret doesn't exist in Secret Manager, fall back to env var
    if (error.code === 5) { // NOT_FOUND
      const envValue = process.env[secretName];
      if (envValue) {
        console.warn(`[Secret Manager] Secret "${secretName}" not found in Secret Manager, using environment variable`);
        return envValue;
      }
      return null;
    }
    
    console.error(`[Secret Manager] Failed to get secret "${secretName}":`, error);
    // Fallback to environment variable
    return process.env[secretName] || null;
  }
}

/**
 * Create or update a secret in Secret Manager
 */
export async function setSecret(
  secretName: string,
  secretValue: string
): Promise<void> {
  if (!secretManagerClient || !projectId) {
    throw new Error('Secret Manager is not initialized');
  }

  try {
    const parent = `projects/${projectId}`;
    
    // Check if secret exists
    try {
      await secretManagerClient.getSecret({ name: `${parent}/secrets/${secretName}` });
    } catch (error: any) {
      // Secret doesn't exist, create it
      if (error.code === 5) { // NOT_FOUND
        await secretManagerClient.createSecret({
          parent,
          secretId: secretName,
          secret: {
            replication: {
              automatic: {},
            },
          },
        });
      } else {
        throw error;
      }
    }

    // Add new version
    await secretManagerClient.addSecretVersion({
      parent: `${parent}/secrets/${secretName}`,
      payload: {
        data: Buffer.from(secretValue, 'utf8'),
      },
    });

    // Clear cache
    secretCache.delete(secretName);
  } catch (error) {
    console.error(`[Secret Manager] Failed to set secret "${secretName}":`, error);
    throw error;
  }
}

/**
 * Get multiple secrets at once
 */
export async function getSecrets(
  secretNames: string[]
): Promise<Record<string, string | null>> {
  const results: Record<string, string | null> = {};
  
  await Promise.all(
    secretNames.map(async (name) => {
      results[name] = await getSecret(name);
    })
  );

  return results;
}

/**
 * Clear secret cache (useful for testing or after secret rotation)
 */
export function clearSecretCache(secretName?: string): void {
  if (secretName) {
    secretCache.delete(secretName);
  } else {
    secretCache.clear();
  }
}

// Initialize on module load
initializeSecretManager();

