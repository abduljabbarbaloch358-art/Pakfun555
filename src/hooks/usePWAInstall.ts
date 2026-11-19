import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Capture beforeinstallprompt at module load time so early browser events are never missed.
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
let globalInstalled = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true);
  if (standalone) {
    globalInstalled = true;
  }

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    globalInstalled = true;
    globalDeferredPrompt = null;
    notifyListeners();
  });
}

export function usePWAInstall() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const update = () => setTick((t) => t + 1);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
  const isAndroid = /Android/i.test(ua);
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  const install = useCallback(async () => {
    if (!globalDeferredPrompt) return false;
    try {
      await globalDeferredPrompt.prompt();
      const { outcome } = await globalDeferredPrompt.userChoice;
      globalDeferredPrompt = null;
      if (outcome === 'accepted') {
        globalInstalled = true;
      }
      notifyListeners();
      return outcome === 'accepted';
    } catch {
      return false;
    }
  }, []);

  return {
    canInstall: !globalInstalled && (globalDeferredPrompt !== null || isIOS || isAndroid),
    hasNativePrompt: globalDeferredPrompt !== null,
    isInstalled: globalInstalled,
    isIOS,
    isAndroid,
    isInIframe,
    install,
  };
}
