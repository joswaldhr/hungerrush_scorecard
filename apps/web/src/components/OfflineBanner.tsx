import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    let dismissTimer: ReturnType<typeof setTimeout>;
    const goOffline = () => { setOffline(true); setWasOffline(true); };
    const goOnline = () => {
      setOffline(false);
      dismissTimer = setTimeout(() => setWasOffline(false), 4000);
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      clearTimeout(dismissTimer);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (offline) {
    return (
      <div className="bg-hr-amber-tint border-b border-hr-amber/30 text-hr-amber-deep flex items-center justify-center gap-2 px-4 py-2.5">
        <WifiOff size={14} aria-hidden="true" />
        <span className="text-sm font-medium">You're offline — showing cached data</span>
      </div>
    );
  }

  if (wasOffline) {
    return (
      <div className="bg-hr-teal-tint border-b border-hr-teal/20 text-hr-teal flex items-center justify-center gap-2 px-4 py-2.5">
        <Wifi size={14} aria-hidden="true" />
        <span className="text-sm font-medium">Back online</span>
      </div>
    );
  }

  return null;
}
