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
    <div className="min-h-screen bg-hr-gray flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-md max-w-sm w-full overflow-hidden">
        <div className="h-1.5 bg-hr-green" />
        <div className="p-8 sm:p-10 text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Manager Scorecard</h1>
          <p className="text-sm text-slate-400 mb-8">
            Sign in with your HungerRush Microsoft account
          </p>
          <button
            onClick={handleLogin}
            className="w-full bg-hr-green text-white py-3 px-6 rounded-lg font-medium hover:bg-hr-green-dark transition-colors"
            aria-label="Sign in with Microsoft"
          >
            Sign in with Microsoft
          </button>
        </div>
      </div>
    </div>
  );
}
