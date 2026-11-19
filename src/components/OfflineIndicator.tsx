import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { Lang, TRANSLATIONS } from '../lib/i18n';

export function OfflineIndicator({ lang }: { lang: Lang }) {
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );
  const t = TRANSLATIONS[lang];

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="bg-amber-500/15 border-b border-amber-400/30 text-amber-200 px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>{t.offlineMsg}</span>
    </div>
  );
}
