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
    <div className="min-h-screen bg-[#04070D] flex items-center justify-center p-4">
      <div className="bg-[#0D121E] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] relative rounded-[20px] shadow-[0_20px_60px_rgba(0,0,0,0.4)] border border-white/10 w-full max-w-sm overflow-hidden text-center z-10">
        <div className="absolute inset-0 bg-[#0D121E]/80 backdrop-blur-md z-0" />
        <div className="relative z-10">
          <div className="h-[5px] bg-[#2BD9BC]" />
          <div className="p-10">
            <div className="flex justify-center mb-3">
              <LogoMark size={30} />
            </div>
            <p className="font-heading text-[38px] font-extrabold text-[#F2F5FA] leading-none mb-2">
              404
            </p>
            <p className="text-[16px] font-semibold text-[#F2F5FA] mb-1">Page not found</p>
            <p className="text-[14px] text-[#98A2B8] mb-8">
              This link may be mistyped, or the page may have moved.
            </p>
            <button
              onClick={() => navigate('/scorecard')}
              className="w-full bg-[#2BD9BC] text-[#101624] rounded-[10px] py-2.5 text-[14px] font-semibold hover:bg-[#2BD9BC]/90 transition-colors shadow-[0_4px_14px_rgba(43,217,188,0.3)]"
            >
              Go to your team
            </button>
          </div>
        </div>
      </div>
      {/* Background flare */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 flex items-center justify-center">
        <div className="absolute w-[600px] h-[600px] bg-[#2BD9BC]/10 rounded-full blur-[100px]" />
      </div>
    </div>
  );
}
