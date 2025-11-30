import { useState, useEffect } from "react";
import type { HighscoreEntry } from "../data/highscores-default";
import { lang } from "../i18n/lang";

export function useGlobalHighscores(limit = 50) {
  const [entries, setEntries] = useState<HighscoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGlobal = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/highscores/global?limit=${limit}`);
      const data = await response.json();
      
      if (data.success && data.entries) {
        setEntries(data.entries);
      } else {
        setError(data.error || lang("HIGHSCORE_ERROR_LOAD_GLOBAL"));
      }
    } catch (err) {
      console.error("[useGlobalHighscores] Error:", err);
      setError(lang("HIGHSCORE_ERROR_LOAD_GLOBAL"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobal();
  }, [limit]);

  return {
    entries,
    loading,
    error,
    refresh: fetchGlobal
  };
}
