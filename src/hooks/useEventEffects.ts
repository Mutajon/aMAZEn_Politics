// src/hooks/useEventEffects.ts
import { useEffect, useRef, useState } from "react";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useRoleStore } from "../store/roleStore";
import { fetchNewsTickerItems } from "../lib/newsTicker";
import { requestMirrorDilemmaLine } from "../lib/mirrorDilemma";
import { demoMirrorLine } from "../components/event/MirrorCard";
import type { TickerItem } from "../components/event/NewsTicker";

export function useEventEffects() {
  const { current, loadNext, loading, error, day } = useDilemmaStore();
  const selectedRole = useRoleStore((s) => s.selectedRole);
  const analysis = useRoleStore((s) => s.analysis);

  // News ticker state
  const [newsItems, setNewsItems] = useState<TickerItem[]>([]);
  const didInitNewsRef = useRef(false);

  // Mirror line state
  const [mirrorText, setMirrorText] = useState(demoMirrorLine());
  const [mirrorLoading, setMirrorLoading] = useState(false);

  // Auto-load a dilemma when accessing event screen, but only after role data is available
  useEffect(() => {
    if (!current && !loading && !error && selectedRole) {
      loadNext();
    }
  }, [current, loading, error, loadNext, selectedRole]);

  // First day: generate 3 items about the player's entry
  useEffect(() => {
    if (!current) return;
    if (didInitNewsRef.current) return;

    if (day <= 1) {
      didInitNewsRef.current = true;
      fetchNewsTickerItems({
        day,
        role: selectedRole,
        systemName: analysis?.systemName,
        // epoch: optional; server will infer if omitted
        last: null,
      }).then((items) => setNewsItems(items));
    }
  }, [current, day, selectedRole, analysis?.systemName]);

  // Mirror line effect
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!current) return;
      setMirrorLoading(true);
      setMirrorText("…the mirror squints, light pooling in the glass…");
      const text = await requestMirrorDilemmaLine(current);
      if (alive) {
        setMirrorText(text);
        setMirrorLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [current]);

  // Function to update news after actions
  const updateNewsAfterAction = (actionData: { title: string; summary: string; cost: number }) => {
    void fetchNewsTickerItems({
      day: day + 0, // reacts to the just-made choice
      role: selectedRole,
      systemName: analysis?.systemName,
      last: actionData,
    }).then((items) => setNewsItems(items));
  };

  return {
    // News state
    newsItems,
    setNewsItems,
    updateNewsAfterAction,

    // Mirror state
    mirrorText,
    setMirrorText,
    mirrorLoading,
    setMirrorLoading,

    // Refs
    didInitNewsRef,
  };
}