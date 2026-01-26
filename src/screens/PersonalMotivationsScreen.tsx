// src/screens/PersonalMotivationsScreen.tsx
import { useState } from "react";
import { bgStyleSplash } from "../lib/ui";
import { useMotivationsStore } from "../store/motivationsStore";
import PersonalMotivationsContent from "../components/PersonalMotivationsContent";
import type { PushFn } from "../lib/router";

export default function PersonalMotivationsScreen({ push }: { push: PushFn }) {
    const { distribution, setDistribution } = useMotivationsStore();
    const [localDistribution, setLocalDistribution] = useState<number[]>(distribution);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSave = async () => {
        setIsSubmitting(true);
        setDistribution(localDistribution);

        // For now, it just saves and goes back to splash
        // In a real flow, this might be sent to the backend
        setTimeout(() => {
            setIsSubmitting(false);
            push("/");
        }, 500);
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
