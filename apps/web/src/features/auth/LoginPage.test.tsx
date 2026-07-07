// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const signInWithOAuth = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args) } },
}));

import { LoginPage } from './LoginPage';

afterEach(() => {
  cleanup();
  signInWithOAuth.mockReset();
});

describe('LoginPage', () => {
  it('renders the Cadence brand card and the Microsoft sign-in button', () => {
    render(<LoginPage />);
    expect(screen.getByText('Cadence')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in with Microsoft' })).toBeTruthy();
  });

  it('recovers from a sign-in that never redirects (S9) — error shows, button re-enables', async () => {
    signInWithOAuth.mockResolvedValue({ error: { message: 'Provider unavailable' } });
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Microsoft' }));
    expect(await screen.findByText('Provider unavailable')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Sign in with Microsoft' });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it('disables the button while the redirect is starting', async () => {
    signInWithOAuth.mockReturnValue(new Promise(() => {}));
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Microsoft' }));
    await waitFor(() => {
      expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    });
    expect(screen.getByText('Signing in…')).toBeTruthy();
  });
});
