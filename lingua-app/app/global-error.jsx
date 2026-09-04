'use client';

import { useEffect } from 'react';
import '../components/PostHogInit';
import { trackEvent } from '../lib/analytics';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    trackEvent('$exception', { error: error?.message });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main>
          <h1>Something went wrong</h1>
          <p>We couldn&apos;t load this page. Please try again.</p>
          <button type="button" onClick={reset}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
