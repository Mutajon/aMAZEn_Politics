// src/lib/router.ts
import { useEffect, useState } from "react";

export type PushFn = (path: string) => void;

export function normalizePath(path: string) {
  return path && path.startsWith("/") ? path : "/" + (path || "");
}

// Minimal hash-router hook
export function useHashRoute() {
  const [route, setRoute] = useState<string>(
    () => window.location.hash.replace("#", "") || "/"
  );
  useEffect(() => {
    const onHashChange = () =>
      setRoute(window.location.hash.replace("#", "") || "/");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const push: PushFn = (path) => {
    window.location.hash = normalizePath(path);
  };
  return { route, push };
}
