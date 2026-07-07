import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const STORAGE_KEY = 'scorecard_tour_complete';

const STEPS = [
  {
    title: 'Welcome',
    body: 'Welcome to Manager Scorecard. This shows how your direct reports are performing this week.',
    icon: (
      <svg className="h-10 w-10 text-hr-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    title: 'Metrics',
    body: 'Each tile shows one metric from Zendesk or Assembled. The sparkline will show trends as weekly data accumulates.',
    icon: (
      <svg className="h-10 w-10 text-hr-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    title: 'Coaching Prompts',
    body: 'Each tile includes a coaching prompt — a conversation starter for your 1:1 meeting.',
    icon: (
      <svg className="h-10 w-10 text-hr-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
  },
  {
    title: 'Notes',
    body: 'Use the notes workspace to capture discussion points and action items during your 1:1.',
    icon: (
      <svg className="h-10 w-10 text-hr-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
      </svg>
    ),
  },
];

interface TourModalProps {
  open: boolean;
  onClose: () => void;
}

export function TourModal({ open, onClose }: TourModalProps) {
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setStep(0);
      dialogRef.current?.focus();
    }
  }, [open]);

  // Esc closes (S3); onClose persists dismissal via useTour, so the tour never resurrects.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const current = STEPS[step] as (typeof STEPS)[number];
  const isLast = step === STEPS.length - 1;

  // Minimal focus trap: keep Tab inside the dialog while it is open.
  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0] as HTMLElement;
    const last = focusables[focusables.length - 1] as HTMLElement;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Welcome tour — ${current.title}`}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        onKeyDown={trapTab}
        className="relative bg-white rounded-xl shadow-panel max-w-md w-full p-6 sm:p-8 outline-none"
      >
        <button
          onClick={onClose}
          aria-label="Close tour"
          className="absolute top-3 right-3 p-1.5 rounded-md text-hr-text-3 hover:text-hr-text-1 hover:bg-hr-sand transition-colors"
        >
          <X size={16} />
        </button>
        <div className="flex flex-col items-center text-center">
          <div className="mb-4">{current.icon}</div>
          <h2 className="text-xl font-semibold text-hr-text-1 mb-2">{current.title}</h2>
          <p className="text-hr-text-2 text-sm leading-relaxed">{current.body}</p>
        </div>

        <div className="flex justify-center gap-1.5 mt-6">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === step ? 'bg-hr-green' : 'bg-hr-sand-md'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
              step === 0
                ? 'text-hr-text-3 cursor-not-allowed'
                : 'text-hr-text-2 hover:bg-hr-sand'
            }`}
          >
            Back
          </button>

          {isLast ? (
            <button
              onClick={onClose}
              className="text-sm font-semibold px-6 py-2 rounded-lg bg-hr-green text-white hover:bg-hr-green-dark transition-colors"
            >
              Done
            </button>
          ) : (
            <button
              onClick={() => setStep(s => s + 1)}
              className="text-sm font-semibold px-6 py-2 rounded-lg bg-hr-green text-white hover:bg-hr-green-dark transition-colors"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function useTour() {
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) !== 'true') {
      setShowTour(true);
    }
  }, []);

  // ANY close counts as done (S3) — X, Esc, backdrop, or the Done button. Persisting
  // here means navigating away can never resurrect the tour on the next visit.
  const closeTour = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setShowTour(false);
  };

  return { showTour, closeTour };
}
