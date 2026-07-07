import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { WarnBanner } from '../../components/WarnBanner';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { AuthCard } from './AuthCard';

export function LoginPage() {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useDocumentTitle('Sign in');

  const handleLogin = async () => {
    setSigningIn(true);
    setError(null);
    // On success this navigates away to Microsoft; the states below only matter
    // when the redirect never fires (S9 — button used to stay stuck on "Signing in...").
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'email profile openid',
        },
      });
      if (err) {
        setError(err.message);
        setSigningIn(false);
      }
    } catch {
      setError('Sign-in could not start. Check your connection and try again.');
      setSigningIn(false);
    }
  };

  return (
    <AuthCard>
      <p className="text-[13px] text-hr-gray text-center mb-7">
        1:1 briefings for HungerRush support leads. Sign in with your Microsoft account to
        continue.
      </p>

      {error && <WarnBanner className="mb-4">{error}</WarnBanner>}

      <button
        onClick={handleLogin}
        disabled={signingIn}
        className="w-full bg-hr-teal text-white rounded-lg py-2.5 text-[14px] font-medium hover:bg-hr-teal/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {signingIn ? 'Signing in…' : 'Sign in with Microsoft'}
      </button>
    </AuthCard>
  );
}
