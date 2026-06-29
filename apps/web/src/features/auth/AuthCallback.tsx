import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate('/dashboard', { replace: true });
          return;
        }

        await waitMs(1000);

        const { data: { session: retrySession }, error: retryError } = await supabase.auth.getSession();
        if (retryError) {
          console.error('getSession retry failed:', retryError);
          setError(retryError.message);
          return;
        }

        if (retrySession) {
          navigate('/dashboard', { replace: true });
        } else {
          console.error('No session after callback. Hash present:', !!window.location.hash);
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
