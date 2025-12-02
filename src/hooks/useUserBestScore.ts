import { useState, useEffect } from "react";

/**
 * Fetch user's best score from MongoDB
 * Used for greeting banner on role selection screen
 */
export function useUserBestScore(userId: string | undefined) {
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchBestScore = async () => {
      try {
        const response = await fetch(`/api/highscores/user/${userId}?limit=1`);
        const data = await response.json();
        
        if (data.success && data.bestScore > 0) {
          setBestScore(data.bestScore);
        }
      } catch (err) {
        console.error("[useUserBestScore] Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBestScore();
  }, [userId]);

  return { bestScore, loading };
}
