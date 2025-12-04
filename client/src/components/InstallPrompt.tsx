/**
 * Install Prompt Component
 * Prompts users to install the PWA
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after a delay (e.g., user has been on site for a bit)
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000); // 3 seconds delay
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if app was just installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for user response
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('[Install] User accepted install prompt');
      setIsInstalled(true);
    } else {
      console.log('[Install] User dismissed install prompt');
    }

    setShowPrompt(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again for this session
    sessionStorage.setItem('installPromptDismissed', 'true');
  };

  // Don't show if already installed or dismissed this session
  if (isInstalled || !showPrompt || !deferredPrompt) {
    return null;
  }

  if (sessionStorage.getItem('installPromptDismissed') === 'true') {
    return null;
  }

  return (
    <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Install Ganttium
          </DialogTitle>
          <DialogDescription>
            Install Ganttium as an app for a better experience. You'll be able to:
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Access your projects offline (up to 7 days)</li>
            <li>Faster loading with cached data</li>
            <li>Native app-like experience</li>
            <li>Receive push notifications</li>
          </ul>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleDismiss}>
              <X className="h-4 w-4 mr-2" />
              Not Now
            </Button>
            <Button onClick={handleInstall}>
              <Download className="h-4 w-4 mr-2" />
              Install
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

