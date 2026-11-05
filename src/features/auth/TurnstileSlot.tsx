"use client";

// Cloudflare Turnstile widget slot (Q-1-16). When NEXT_PUBLIC_TURNSTILE_SITE_KEY is set it loads the
// Turnstile script and renders the managed widget, handing the solved token up via onToken. When the key
// is not configured (e.g. local dev before the credential exists) it shows a neutral placeholder so the
// screen is complete and reports an empty token; the real bot check appears once the key is set. Placement
// is just above the Sign in button (assumption — the widget is not in the Figma design). onToken must be a
// stable reference (pass a state setter) so the widget is not re-rendered on every keystroke.

import { useEffect, useRef } from "react";
import styles from "./TurnstileSlot.module.css";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render(
    el: HTMLElement,
    opts: {
      sitekey: string;
      theme: "light" | "dark" | "auto";
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
    },
  ): string;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileSlot({ onToken }: { onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  useEffect(() => {
    if (!SITE_KEY) {
      onToken("");
      return;
    }

    function renderWidget() {
      if (renderedRef.current || !containerRef.current || !window.turnstile) return;
      renderedRef.current = true;
      window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY as string,
        theme: "light",
        callback: (token) => onToken(token),
        "error-callback": () => onToken(""),
        "expired-callback": () => onToken(""),
      });
    }

    if (window.turnstile) {
      renderWidget();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
    if (existing) {
      existing.addEventListener("load", renderWidget, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.dataset.turnstile = "true";
    script.addEventListener("load", renderWidget, { once: true });
    document.head.appendChild(script);
  }, [onToken]);

  if (!SITE_KEY) {
    return (
      <div className={styles.placeholder} aria-hidden="true">
        Bot check appears here once configured
      </div>
    );
  }
  return <div ref={containerRef} className={styles.widget} />;
}
