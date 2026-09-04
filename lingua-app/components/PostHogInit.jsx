'use client';

import posthog from 'posthog-js';

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (typeof window !== 'undefined') {
  if (!projectToken || !host) {
    if (process.env.NODE_ENV !== 'production') {
      const missingVariable = !projectToken
        ? 'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN'
        : 'NEXT_PUBLIC_POSTHOG_HOST';
      console.warn(
        `${missingVariable} variable required by PostHog is missing or un-configured, so analytics are disabled in this environment.`
      );
    }
  } else {
    posthog.init(projectToken, {
      api_host: host,
      defaults: '2026-01-30',
      capture_exceptions: true,
      debug: process.env.NODE_ENV === 'development',
    });
  }
}

export default function PostHogInit() {
  return null;
}
