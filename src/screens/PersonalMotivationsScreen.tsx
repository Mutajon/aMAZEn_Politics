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
            className="fixed inset-0 flex flex-col overflow-y-auto"
            style={bgStyleSplash}
        >
            {/* Semi-transparent overlay */}
            <div className="fixed inset-0 bg-black/60 pointer-events-none" />

            <PersonalMotivationsContent
                distribution={localDistribution}
                onChange={setLocalDistribution}
                onSave={handleSave}
                isSubmitting={isSubmitting}
            />
        </div>
    );
}
