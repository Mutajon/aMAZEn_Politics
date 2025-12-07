import { useState, useEffect } from "react";
import type { HighscoreEntry } from "../data/highscores-default";
import { lang } from "../i18n/lang";

export function useUserHighscores(userId: string, limit = 50, role?: string) {
  const [entries, setEntries] = useState<HighscoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bestScore, setBestScore] = useState(0);

  const fetchUser = async () => {
    if (!userId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = role
        ? `/api/highscores/user/${userId}?limit=${limit}&role=${encodeURIComponent(role)}`
        : `/api/highscores/user/${userId}?limit=${limit}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.success && data.entries) {
        setEntries(data.entries);
        setBestScore(data.bestScore || 0);
      } else {
        setError(data.error || lang("HIGHSCORE_ERROR_LOAD_USER"));
      }
    } catch (err) {
      console.error("[useUserHighscores] Error:", err);
      setError(lang("HIGHSCORE_ERROR_LOAD_USER"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, [userId, limit, role]);

  return {
    entries,
    loading,
    error,
    bestScore,
    refresh: fetchUser
  };
}
