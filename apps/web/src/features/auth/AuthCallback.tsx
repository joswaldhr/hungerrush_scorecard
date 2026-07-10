import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { WarnBanner } from '../../components/WarnBanner';
import { AuthCard } from './AuthCard';

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
          navigate('/scorecard', { replace: true });
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
          navigate('/scorecard', { replace: true });
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
      <AuthCard>
        <h1 className="font-heading text-[16px] font-bold text-[#F2F5FA] text-center mb-4">
          Sign-in didn&apos;t complete
        </h1>
        <WarnBanner className="mb-6">{error}</WarnBanner>
        <button
          onClick={() => navigate('/login', { replace: true })}
          className="w-full bg-[#2BD9BC] text-[#101624] rounded-xl py-2.5 text-[15px] font-semibold hover:bg-[#2BD9BC]/90 transition-colors"
        >
          Back to login
        </button>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <div className="animate-pulse space-y-2.5" aria-hidden="true">
        <div className="h-3.5 bg-white/10 rounded" />
        <div className="h-3.5 bg-white/10 rounded w-2/3 mx-auto" />
      </div>
      <p className="text-[14px] text-[#98A2B8] text-center mt-4">Signing you in…</p>
    </AuthCard>
  );
}
