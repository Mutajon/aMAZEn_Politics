import { useState, useEffect } from "react";
import type { HighscoreEntry } from "../data/highscores-default";

export function useUserHighscores(userId: string, limit = 50) {
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
      const response = await fetch(`/api/highscores/user/${userId}?limit=${limit}`);
      const data = await response.json();
      
      if (data.success && data.entries) {
        setEntries(data.entries);
        setBestScore(data.bestScore || 0);
      } else {
        setError(data.error || "Failed to load your scores");
      }
    } catch (err) {
      console.error("[useUserHighscores] Error:", err);
      setError("Failed to load your scores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, [userId, limit]);

  return {
    entries,
    loading,
    error,
    bestScore,
    refresh: fetchUser
  };
}
