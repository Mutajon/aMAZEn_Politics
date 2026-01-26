// src/screens/PersonalMotivationsScreen.tsx
import { useState } from "react";
import { bgStyleSplash } from "../lib/ui";
import { useMotivationsStore } from "../store/motivationsStore";
import { saveMotivations } from "../lib/motivationsLogic";
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

        // Check if this is a post-game submission
        const isPostGame = window.location.hash.includes("type=post-game");

        await saveMotivations(
            localDistribution,
            isPostGame ? "post-game" : "initial",
            lang
        );

        setIsSubmitting(false);

        if (isPostGame) {
            push("/thank-you");
        } else {
            push("/");
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
