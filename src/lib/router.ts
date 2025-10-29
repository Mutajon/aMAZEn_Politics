// src/lib/router.ts
import { useEffect, useState, useCallback, useRef } from "react";
import { loggingService } from "./loggingService";
import { useSettingsStore } from "../store/settingsStore";

export type PushFn = (path: string) => void;

/** Coerce any incoming path/hash into a canonical form we can match on in App.tsx. */
function normalizePath(path: string): string {
  const s = String(path ?? "")
    .trim()
    // convert unicode dashes to ASCII hyphen to avoid "/compass–intro" mismatches
    .replace(/\u2012|\u2013|\u2014|\u2212/g, "-")
    // collapse multiple slashes
    .replace(/\/{2,}/g, "/")
    // ensure we don’t carry a leading '#'
    .replace(/^#/, "");
  // ensure exactly one leading slash, drop trailing slash (except root)
  let p = s.startsWith("/") ? s : "/" + s;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  // guard empty
  return p === "" ? "/" : p;
}

function readHash(): string {
  const raw = typeof window !== "undefined" ? window.location.hash : "";
  const noHash = raw.replace(/^#/, "");
  // treat empty as root; otherwise normalize what we found
  return noHash ? normalizePath(noHash) : "/";
}

/** Minimal hash-router hook (no whitelist needed). */
export function useHashRoute() {
  const [route, setRoute] = useState<string>(readHash());
  // Initialize with readHash() to ensure it's never empty
  const previousRouteRef = useRef<string>(readHash());

  useEffect(() => {
    const onHashChange = () => {
      const newRoute = readHash();
      const previousRoute = previousRouteRef.current || '/';  // Guard against empty/undefined

      // Log navigation if logging is enabled
      const { dataCollectionEnabled } = useSettingsStore.getState();
      if (dataCollectionEnabled && newRoute !== previousRoute) {
        loggingService.log(
          'navigation',
          newRoute,  // Simple value: where user is going
          `User navigated from ${previousRoute} to ${newRoute}`,
          { screen: newRoute }  // Metadata for currentScreen field
        );
      }

      previousRouteRef.current = newRoute;
      setRoute(newRoute);
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const push = useCallback<PushFn>((path: string) => {
    const next = normalizePath(path);
    // only update if it's actually different to avoid duplicate events
    const curr = readHash();
    if (next !== curr) {
      window.location.hash = next; // browser will prepend '#'
    } else {
      // still set state so any listeners react
      setRoute(next);
    }
  }, []);

  return { route, push };
}
