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
      <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-[#E8E6E1] w-full max-w-sm overflow-hidden">
          <div className="h-1 bg-[#1D9E75]" />
          <div className="p-10">
            <div className="w-9 h-9 rounded-lg bg-[#1E2E4A] flex items-center justify-center mx-auto mb-5">
              <span className="text-white text-[14px] font-semibold">HR</span>
            </div>
            <h1 className="text-[20px] font-medium text-slate-800 text-center mb-4">
              Sign-in failed
            </h1>
            <div className="bg-[#FFFBEB] border border-[#D97706]/20 text-[#92400E] rounded-lg p-3 text-[13px] mb-6">
              {error}
            </div>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full bg-[#1D9E75] text-white rounded-lg py-2.5 text-[14px] font-medium hover:bg-[#0F6E56] transition-colors"
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hr-bg flex items-center justify-center">
      <div className="animate-pulse text-hr-navy text-lg">Signing you in...</div>
    </div>
  );
}
