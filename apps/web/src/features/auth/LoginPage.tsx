import { supabase } from '../../lib/supabase';

export function LoginPage() {
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'email profile openid',
      },
    });
  };

  return (
    <div className="min-h-screen bg-hr-gray flex items-center justify-center">
      <div className="bg-white p-4 sm:p-8 rounded-lg shadow-sm max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-hr-navy mb-2">Manager Scorecard</h1>
        <p className="text-slate-500 mb-6">
          Sign in with your HungerRush Microsoft account to continue.
        </p>
        <button
          onClick={handleLogin}
          className="w-full bg-hr-green text-white py-3 px-6 rounded-md font-medium hover:bg-hr-green-dark transition-colors"
          aria-label="Sign in with Microsoft"
        >
          Sign in with Microsoft
        </button>
      </div>
    </div>
  );
}
