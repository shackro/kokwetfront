import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getJson } from './api';

const SiteContentContext = createContext(null);

export function SiteContentProvider({ children }) {
  const [content, setContent] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    getJson('/site-content')
      .then((data) => {
        if (active) {
          setContent(data);
          setLoadError('');
        }
      })
      .catch((error) => {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load site settings.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => ({ content, loadError }), [content, loadError]);
  return <SiteContentContext.Provider value={value}>{children}</SiteContentContext.Provider>;
}

export function useSiteContent() {
  return useContext(SiteContentContext) || { content: null, loadError: '' };
}
