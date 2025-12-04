/**
 * Push Notification Settings Component
 * Allows users to enable/disable push notifications
 */

import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Bell, BellOff, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function PushNotificationSettings() {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Receive notifications even when the app is closed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Push notifications are not supported in this browser.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (permission === 'denied') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Receive notifications even when the app is closed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Push notifications are blocked. Please enable them in your browser settings.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Receive notifications even when the app is closed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="push-notifications">Enable Push Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Get notified about important project updates, task assignments, and more.
            </p>
          </div>
          <Switch
            id="push-notifications"
            checked={isSubscribed}
            onCheckedChange={handleToggle}
            disabled={isLoading || permission !== 'granted'}
          />
        </div>

        {permission === 'default' && (
          <Button
            onClick={async () => {
              const granted = await subscribe();
              if (!granted) {
                alert('Please allow notifications to enable push notifications.');
              }
            }}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Enabling...' : 'Enable Notifications'}
          </Button>
        )}

        {isSubscribed && (
          <Alert>
            <Bell className="h-4 w-4" />
            <AlertDescription>
              Push notifications are enabled. You'll receive notifications for important updates.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
