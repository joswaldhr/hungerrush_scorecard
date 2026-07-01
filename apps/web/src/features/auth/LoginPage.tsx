import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export function LoginPage() {
  const [signingIn, setSigningIn] = useState(false);

  const handleLogin = async () => {
    setSigningIn(true);
    await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'email profile openid',
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E8E6E1] w-full max-w-sm overflow-hidden">
        <div className="h-1 bg-[#1D9E75]" />

        <div className="p-10">
          <div className="w-9 h-9 rounded-lg bg-[#1E2E4A] flex items-center justify-center mx-auto mb-5">
            <span className="text-white text-[14px] font-semibold">HR</span>
          </div>

          <h1 className="text-[20px] font-medium text-slate-800 text-center">
            Manager Scorecard
          </h1>

          <p className="text-[13px] text-slate-400 text-center mt-1.5 mb-7">
            Sign in with your HungerRush Microsoft account to continue.
          </p>

          <button
            onClick={handleLogin}
            disabled={signingIn}
            className="w-full bg-[#1D9E75] text-white rounded-lg py-2.5 text-[14px] font-medium hover:bg-[#0F6E56] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {signingIn ? 'Signing in...' : 'Sign in with Microsoft'}
          </button>
        </div>
      </div>
    </div>
  );
}
