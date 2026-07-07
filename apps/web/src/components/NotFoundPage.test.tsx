// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { NotFoundPage } from './NotFoundPage';

afterEach(cleanup);

describe('NotFoundPage', () => {
  it('says the page is missing, sets the document title, and offers a way home', () => {
    render(
      <MemoryRouter initialEntries={['/no-such-page']}>
        <Routes>
          <Route path="*" element={<NotFoundPage />} />
          <Route path="/scorecard" element={<p>home surface</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Page not found')).toBeTruthy();
    expect(document.title).toBe('Page not found · HungerRush Cadence');

    fireEvent.click(screen.getByRole('button', { name: 'Go to your team' }));
    expect(screen.getByText('home surface')).toBeTruthy();
  });
});
