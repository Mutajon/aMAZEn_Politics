import { ensureUserId } from "../store/loggingStore";
import { COMPONENTS } from "../data/compass-data";
import { useCompassStore } from "../store/compassStore";

export type MotivationType = "initial" | "post-game";

export async function saveMotivations(
    distribution: number[],
    type: MotivationType,
    lang: (key: string) => string
): Promise<boolean> {
    try {
        const userId = ensureUserId();

        // 1. Log to backend
        const motivationsLog = COMPONENTS.what.map((c, i) => ({
            id: c.short,
            name: lang(`COMPASS_VALUE_${c.short.replace("/", "_").replace(".", "").toUpperCase()}`),
            percent: distribution[i] || 0
        }));

        const response = await fetch('/api/motivations-questionnaire', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                timestamp: Date.now(),
                type,
                motivations: motivationsLog
            })
        });

        if (!response.ok) {
            console.error("Failed to save motivations to backend");
        }

        // 2. Update compassStore if initial
        if (type === "initial") {
            const scaledValues = distribution.map(v => Math.floor(v / 10));
            useCompassStore.getState().setPropValues("what", scaledValues);
            console.log("[Motivations] Updated compassStore 'what' values:", scaledValues);
        }

        return response.ok;
    } catch (error) {
        console.error("Error saving motivations:", error);
        return false;
    }
}
