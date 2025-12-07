import { useState, useEffect } from "react";

export function useGlobalRoleBests() {
    const [bests, setBests] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchBests = async () => {
            setLoading(true);
            try {
                const response = await fetch("/api/highscores/bests-by-role");
                const data = await response.json();

                if (data.success) {
                    setBests(data.bests || {});
                } else {
                    setError(data.error || "Failed to fetch global role bests");
                }
            } catch (err: any) {
                setError(err.message || "Failed to fetch global role bests");
            } finally {
                setLoading(false);
            }
        };

        fetchBests();
    }, []);

    return { bests, loading, error };
}
