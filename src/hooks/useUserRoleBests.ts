import { useState, useEffect } from "react";

export function useUserRoleBests(userId: string | null) {
    const [bests, setBests] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }

        const fetchBests = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/highscores/user/${userId}/bests-by-role`);
                const data = await response.json();

                if (data.success) {
                    setBests(data.bests || {});
                } else {
                    setError(data.error || "Failed to fetch user role bests");
                }
            } catch (err: any) {
                setError(err.message || "Failed to fetch user role bests");
            } finally {
                setLoading(false);
            }
        };

        fetchBests();
    }, [userId]);

    return { bests, loading, error };
}
