import { useState, useEffect } from "react";

/**
 * Fetch global #1 best score from MongoDB
 * Used for greeting banner on role selection screen
 */
export function useGlobalBestScore() {
  const [globalBest, setGlobalBest] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGlobalBest = async () => {
      try {
        const response = await fetch('/api/highscores/global?limit=1');
        const data = await response.json();
        
        if (data.success && data.entries && data.entries.length > 0) {
          setGlobalBest(data.entries[0].score);
        }
      } catch (err) {
        console.error("[useGlobalBestScore] Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchGlobalBest();
  }, []);

  return { globalBest, loading };
}
