/**
 * Push Notification Service
 * Handles sending push notifications to subscribed users
 */

import webpush from 'web-push';
import { storage } from '../storage';
import { logger } from './cloudLogging';
import { getSecret } from './secretManager';

let vapidKeys: { publicKey: string; privateKey: string } | null = null;

/**
 * Initialize VAPID keys
 * Gets keys from environment variables or Secret Manager
 */
async function initializeVAPIDKeys(): Promise<void> {
  if (vapidKeys) {
    return; // Already initialized
  }

  try {
    // Try to get from Secret Manager or environment variables
    const publicKey = await getSecret('VAPID_PUBLIC_KEY') || process.env.VAPID_PUBLIC_KEY;
    const privateKey = await getSecret('VAPID_PRIVATE_KEY') || process.env.VAPID_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
      logger.warn('[Push] VAPID keys not configured. Push notifications will be disabled.');
      logger.warn('[Push] Generate keys with: npm run generate-vapid-keys');
      return;
    }

    vapidKeys = { publicKey, privateKey };

    // Set VAPID details for web-push
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@ganttium.com',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );

    logger.info('[Push] VAPID keys initialized');
  } catch (error) {
    logger.error('[Push] Failed to initialize VAPID keys:', error);
  }
}

/**
 * Get VAPID public key (for frontend subscription)
 */
export async function getVAPIDPublicKey(): Promise<string | null> {
  await initializeVAPIDKeys();
  return vapidKeys?.publicKey || null;
}

/**
 * Send push notification to a user
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  options?: {
    icon?: string;
    badge?: string;
    tag?: string;
    data?: any;
    requireInteraction?: boolean;
    silent?: boolean;
  }
): Promise<void> {
  await initializeVAPIDKeys();

  if (!vapidKeys) {
    logger.warn('[Push] Cannot send push notification - VAPID keys not configured');
    return;
  }

  try {
    // Get user's push subscriptions
    const subscriptions = await storage.getPushSubscriptionsByUser(userId);

    if (subscriptions.length === 0) {
      logger.debug(`[Push] No push subscriptions found for user ${userId}`);
      return;
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: options?.icon || '/favicon.png',
      badge: options?.badge || '/favicon.png',
      tag: options?.tag || 'notification',
      data: options?.data || {},
      requireInteraction: options?.requireInteraction || false,
      silent: options?.silent || false,
    });

    // Send to all active subscriptions
    const results = await Promise.allSettled(
      subscriptions
        .filter((sub) => sub.enabled)
        .map(async (subscription) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: {
                  p256dh: subscription.p256dh,
                  auth: subscription.auth,
                },
              },
              payload
            );
            logger.debug(`[Push] Notification sent to ${userId} (${subscription.id})`);
            return { success: true, subscriptionId: subscription.id };
          } catch (error: any) {
            // Handle expired/invalid subscriptions
            if (error.statusCode === 410 || error.statusCode === 404) {
              logger.warn(`[Push] Subscription ${subscription.id} expired, removing`);
              await storage.deletePushSubscription(subscription.id);
            } else {
              logger.error(`[Push] Failed to send to subscription ${subscription.id}:`, error);
            }
            return { success: false, subscriptionId: subscription.id, error };
          }
        })
    );

    const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    if (successful > 0) {
      logger.info(`[Push] Sent ${successful} notification(s) to user ${userId}${failed > 0 ? ` (${failed} failed)` : ''}`);
    }
  } catch (error) {
    logger.error(`[Push] Error sending push notification to user ${userId}:`, error);
    throw error;
  }
}

/**
 * Send push notification to multiple users
 */
export async function sendPushNotificationToUsers(
  userIds: string[],
  title: string,
  body: string,
  options?: {
    icon?: string;
    badge?: string;
    tag?: string;
    data?: any;
    requireInteraction?: boolean;
    silent?: boolean;
  }
): Promise<void> {
  await Promise.allSettled(
    userIds.map((userId) => sendPushNotification(userId, title, body, options))
  );
}

/**
 * Send push notification based on notification rule
 * Integrates with existing notification service
 */
export async function sendPushNotificationForRule(
  ruleId: number,
  title: string,
  body: string,
  userIds: string[],
  options?: {
    icon?: string;
    badge?: string;
    tag?: string;
    data?: any;
  }
): Promise<void> {
  // Only send push if rule has push enabled
  // This would require checking the notification rule configuration
  // For now, send to all provided users
  await sendPushNotificationToUsers(userIds, title, body, {
    ...options,
    tag: `rule-${ruleId}`,
    data: {
      ...options?.data,
      ruleId,
    },
  });
}

// Initialize on module load
initializeVAPIDKeys().catch((error) => {
  logger.error('[Push] Failed to initialize VAPID keys on module load:', error);
});
