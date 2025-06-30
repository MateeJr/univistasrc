"use client";

import { useEffect } from "react";

/**
 * Patch the global fetch on the client so that any request that still points
 * to the hard-coded backend base URL (http://193.70.34.25:20096) is converted
 * to a same-origin relative URL. This prevents mixed-content errors when the
 * site is served over HTTPS (e.g. on Vercel).
 */
export default function FetchProxy() {
  useEffect(() => {
    const BACKEND = "http://193.70.34.25:20096";

    // Ensure we only patch once and in browsers.
    if (typeof window === "undefined" || (window as any).__FETCH_PROXY_PATCHED__) {
      return;
    }
    (window as any).__FETCH_PROXY_PATCHED__ = true;

    const originalFetch = window.fetch.bind(window);

    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      // Handle string URL input
      if (typeof input === "string") {
        if (input.startsWith(BACKEND)) {
          input = input.replace(BACKEND, "");
        }
      } else if (input instanceof Request) {
        // Handle Request object input
        if (input.url.startsWith(BACKEND)) {
          input = new Request(input.url.replace(BACKEND, ""), input);
        }
      }
      return originalFetch(input, init);
    };
  }, []);

  // No UI – this component only applies the side-effect.
  return null;
}
