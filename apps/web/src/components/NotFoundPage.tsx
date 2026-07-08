import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { LogoMark } from './AppLayout';

/**
 * S10: unknown paths get a real page instead of silently redirecting — a
 * mistyped deep link should say so. Public-safe (no AppLayout, no auth).
 */
export function NotFoundPage() {
  const navigate = useNavigate();
  useDocumentTitle('Page not found');

  return (
    <div className="min-h-screen bg-hr-bg flex items-center justify-center p-4">
      <div className="bg-hr-card rounded-2xl border border-hr-line shadow-card w-full max-w-sm overflow-hidden text-center">
        <div className="h-[5px] bg-hr-teal" />
        <div className="p-10">
          <div className="flex justify-center mb-3">
            <LogoMark size={30} />
          </div>
          <p className="font-heading text-[38px] font-extrabold text-hr-navy leading-none mb-2">
            404
          </p>
          <p className="text-base font-medium text-hr-navy mb-1">Page not found</p>
          <p className="text-base text-hr-gray mb-6">
            This link may be mistyped, or the page may have moved.
          </p>
          <button
            onClick={() => navigate('/scorecard')}
            className="w-full bg-hr-teal text-white rounded-lg py-2.5 text-base font-medium hover:bg-hr-teal/90 transition-colors"
          >
            Go to your team
          </button>
        </div>
      </div>
    </div>
  );
}
