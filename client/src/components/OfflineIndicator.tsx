/**
 * Offline Indicator Component
 * Shows offline status and sync progress
 */

import { useOffline } from "@/hooks/useOffline";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";
import { useState } from "react";

export function OfflineIndicator() {
  const { isOnline, wasOffline, syncWhenOnline } = useOffline();
  const [isSyncing, setIsSyncing] = useState(false);

  if (isOnline && !wasOffline) {
    return null; // Don't show anything when online and never was offline
  }

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncWhenOnline();
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOnline) {
    return (
      <Alert className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto z-50 border-amber-500 bg-amber-50 dark:bg-amber-950">
        <WifiOff className="h-4 w-4 text-amber-600" />
        <AlertDescription className="flex items-center gap-2">
          <span>You are offline. Changes will be synced when connection is restored.</span>
        </AlertDescription>
      </Alert>
    );
  }

  if (wasOffline) {
    return (
      <Alert className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto z-50 border-green-500 bg-green-50 dark:bg-green-950">
        <Wifi className="h-4 w-4 text-green-600" />
        <AlertDescription className="flex items-center gap-2">
          <span>Connection restored.</span>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSync}
            disabled={isSyncing}
            className="h-7"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-1" />
                Sync Now
              </>
            )}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

