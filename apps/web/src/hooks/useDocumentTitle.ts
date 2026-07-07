import { useEffect } from 'react';

const BASE_TITLE = 'HungerRush Cadence';

/**
 * Per-route document title (S12). Not a data hook — no S5 contract.
 * Pass the page name; undefined falls back to the bare product name.
 */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE_TITLE}` : BASE_TITLE;
  }, [title]);
}
