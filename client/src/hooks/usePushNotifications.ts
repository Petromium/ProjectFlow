/**
 * Push Notifications Hook
 * Manages push notification subscription and permission
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { apiRequest } from '@/lib/queryClient';

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check if push notifications are supported
  useEffect(() => {
    const checkSupport = () => {
      const supported =
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;
      setIsSupported(supported);

      if (supported && 'Notification' in window) {
        setPermission(Notification.permission);
      }
    };

    checkSupport();
  }, []);

  // Get VAPID public key
  useEffect(() => {
    if (!isSupported || !user) return;

    const fetchVAPIDKey = async () => {
      try {
        const response = await fetch('/api/push/vapid-public-key', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setVapidPublicKey(data.publicKey);
        }
      } catch (error) {
        console.error('[Push] Failed to get VAPID key:', error);
      }
    };

    fetchVAPIDKey();
  }, [isSupported, user]);

  // Check subscription status
  useEffect(() => {
    if (!isSupported || !vapidPublicKey) return;

    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (error) {
        console.error('[Push] Failed to check subscription:', error);
      }
    };

    checkSubscription();
  }, [isSupported, vapidPublicKey]);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn('[Push] Push notifications not supported');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('[Push] Failed to request permission:', error);
      return false;
    }
  }, [isSupported]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !vapidPublicKey || !user) {
      console.warn('[Push] Cannot subscribe - missing requirements');
      return false;
    }

    setIsLoading(true);

    try {
      // Request permission if not granted
      if (permission !== 'granted') {
        const granted = await requestPermission();
        if (!granted) {
          setIsLoading(false);
          return false;
        }
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push service
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // Extract subscription data
      const subscriptionData: PushSubscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: arrayBufferToBase64(subscription.getKey('auth')!),
        },
      };

      // Send subscription to server
      const response = await apiRequest('POST', '/api/push/subscribe', subscriptionData);
      if (response.ok) {
        setIsSubscribed(true);
        console.log('[Push] Successfully subscribed to push notifications');
        return true;
      } else {
        throw new Error('Failed to save subscription');
      }
    } catch (error: any) {
      console.error('[Push] Failed to subscribe:', error);
      if (error.name === 'NotAllowedError') {
        alert('Push notifications were blocked. Please enable them in your browser settings.');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, vapidPublicKey, user, permission, requestPermission]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !user) {
      return false;
    }

    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Get subscription ID from server
        const subscriptionsResponse = await fetch('/api/push/subscriptions', {
          credentials: 'include',
        });
        if (subscriptionsResponse.ok) {
          const subscriptions = await subscriptionsResponse.json();
          const serverSubscription = subscriptions.find(
            (sub: any) => sub.endpoint === subscription.endpoint
          );

          if (serverSubscription) {
            await apiRequest('DELETE', `/api/push/unsubscribe/${serverSubscription.id}`);
          }
        }

        // Unsubscribe from push service
        await subscription.unsubscribe();
        setIsSubscribed(false);
        console.log('[Push] Successfully unsubscribed from push notifications');
        return true;
      }
    } catch (error) {
      console.error('[Push] Failed to unsubscribe:', error);
      return false;
    } finally {
      setIsLoading(false);
    }

    return false;
  }, [isSupported, user]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    requestPermission,
  };
}

// Helper: Convert VAPID key from base64 URL to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Helper: Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
