import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const goOffline = () => { setOffline(true); setWasOffline(true); };
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (offline) {
    return (
      <div className="bg-hr-amber-light border-b border-half border-hr-amber/20 text-hr-amber flex items-center justify-center gap-2 px-4 py-2.5">
        <WifiOff size={14} aria-hidden="true" />
        <span className="text-sm font-medium">You're offline — showing cached data</span>
      </div>
    );
  }

  if (wasOffline) {
    return (
      <div className="bg-hr-green-light border-b border-half border-hr-green/20 text-hr-green-dark flex items-center justify-center gap-2 px-4 py-2.5">
        <Wifi size={14} aria-hidden="true" />
        <span className="text-sm font-medium">Back online</span>
      </div>
    );
  }

  return null;
}
