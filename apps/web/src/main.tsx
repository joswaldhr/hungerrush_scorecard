import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const savedMode = localStorage.getItem('hr-color-mode');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
if (savedMode === 'dark' || (!savedMode && prefersDark)) {
  document.documentElement.classList.add('dark');
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
