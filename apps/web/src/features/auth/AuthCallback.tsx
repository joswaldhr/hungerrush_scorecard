import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

function parseHashParams(hash: string): Record<string, string> {
  const params: Record<string, string> = {};
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  for (const pair of raw.split('&')) {
    const [key, value] = pair.split('=');
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(value ?? '');
  }
  return params;
}

export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const hash = window.location.hash;
        console.log('Auth callback hash present:', !!hash, 'length:', hash.length);

        if (hash && hash.includes('access_token')) {
          const params = parseHashParams(hash);
          const accessToken = params['access_token'];
          const refreshToken = params['refresh_token'];

          if (!accessToken || !refreshToken) {
            setError('Missing tokens in callback URL.');
            return;
          }

          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error('setSession failed:', sessionError);
            setError(sessionError.message);
            return;
          }

          navigate('/dashboard', { replace: true });
          return;
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('getSession failed:', sessionError);
          setError(sessionError.message);
          return;
        }

        if (session) {
          navigate('/dashboard', { replace: true });
        } else {
          console.error('No session after callback. URL:', window.location.href);
          setError('No session received. Please try logging in again.');
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError(err instanceof Error ? err.message : 'Unknown auth error');
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-hr-gray flex items-center justify-center">
        <div className="text-center max-w-md p-6">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="px-4 py-2 bg-hr-green text-white rounded hover:bg-hr-green-dark"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hr-gray flex items-center justify-center">
      <div className="animate-pulse text-hr-navy text-lg">Signing you in...</div>
    </div>
  );
}
