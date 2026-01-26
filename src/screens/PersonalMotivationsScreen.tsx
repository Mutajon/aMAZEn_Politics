// src/screens/PersonalMotivationsScreen.tsx
import { useState } from "react";
import { bgStyleSplash } from "../lib/ui";
import { useMotivationsStore } from "../store/motivationsStore";
import { ensureUserId } from "../store/loggingStore";
import { COMPONENTS } from "../data/compass-data";
import { useLang } from "../i18n/lang";
import PersonalMotivationsContent from "../components/PersonalMotivationsContent";
import type { PushFn } from "../lib/router";

export default function PersonalMotivationsScreen({ push }: { push: PushFn }) {
    const { distribution, setDistribution } = useMotivationsStore();
    const [localDistribution, setLocalDistribution] = useState<number[]>(distribution);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const lang = useLang();

    const handleSave = async () => {
        setIsSubmitting(true);
        setDistribution(localDistribution);

        try {
            const userId = ensureUserId();

            // Map distribution to motivations log format
            const motivationsLog = COMPONENTS.what.map((c, i) => ({
                id: c.short,
                name: lang(`COMPASS_VALUE_${c.short.replace("/", "_").replace(".", "").toUpperCase()}`),
                percent: localDistribution[i] || 0
            }));

            const response = await fetch('/api/motivations-questionnaire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    timestamp: Date.now(),
                    type: "initial",
                    motivations: motivationsLog
                })
            });

            if (!response.ok) {
                console.error("Failed to save motivations to backend");
            }

            push("/");
        } catch (error) {
            console.error("Error saving motivations:", error);
            // Fallback: still navigate back
            push("/");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            className="min-h-dvh w-full flex items-center justify-center p-4 overflow-y-auto"
            style={bgStyleSplash}
        >
            <PersonalMotivationsContent
                distribution={localDistribution}
                onChange={setLocalDistribution}
                onSave={handleSave}
                isSubmitting={isSubmitting}
            />
        </div>
    );
}
