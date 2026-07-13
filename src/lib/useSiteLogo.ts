'use client';

import { useState, useEffect } from 'react';

export function useSiteLogo() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const res = await fetch('/api/logo');
        if (res.redirected) {
          setLogoUrl(res.url);
        } else {
          const data = await res.json();
          if (data?.url) setLogoUrl(data.url);
        }
      } catch {
        setLogoUrl('/logo.png');
      }
      setLoading(false);
    };
    fetchLogo();
  }, []);

  return { logoUrl: logoUrl || '/logo.png', loading };
}
