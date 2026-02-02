import React, { useState } from "react";
import { useHashRoute } from "../lib/router";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useRoleStore } from "../store/roleStore";
import { PREDEFINED_ROLES_ARRAY } from "../data/predefinedRoles";

// Model Pricing Data (Per 1 Million Tokens)
const MODEL_OPTIONS = [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", price: "$0.15 / $0.60" },
    { value: "gemini-2.5-flash-preview-09-2025", label: "Gemini 2.5 Flash Preview (09-2025)", price: "$0.15 / $0.60" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", price: "$1.25 / $10.00" },
    { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview", price: "$0.50 / $3.00" },
    { value: "gemini-3-pro-preview", label: "Gemini 3 Pro Preview", price: "Preview Pricing" },
];

// Map scenarios for the dropdown
const SCENARIO_OPTIONS = PREDEFINED_ROLES_ARRAY.flatMap(role => {
    // For roles like Athens and North America, provide with/without emphasis
    if (role.id === "athens_431" || role.id === "north_america_1607") {
        return [
            { id: role.id, label: `${role.id.split('_')[0].toUpperCase()} (With Emphasis)`, disableEmphasis: false },
            { id: role.id, label: `${role.id.split('_')[0].toUpperCase()} (No Emphasis)`, disableEmphasis: true }
        ];
    }
    return [{ id: role.id, label: role.id.toUpperCase(), disableEmphasis: false }];
});

export const LabSplashScreen: React.FC = () => {
    const { push } = useHashRoute();
    const { setAiModelOverride, reset, initializeGame, setGamePhase } = useDilemmaStore();
    const [selectedModel, setSelectedModel] = useState(MODEL_OPTIONS[0].value);
    const [selectedScenarioIndex, setSelectedScenarioIndex] = useState(0);

    const handleStart = () => {
        const scenarioOption = SCENARIO_OPTIONS[selectedScenarioIndex];
        const scenario = PREDEFINED_ROLES_ARRAY.find(r => r.id === scenarioOption.id);

        if (!scenario) return;

        // 1. Reset Game State
        reset();

        // 2. Set Model Override (Persistence handled by store)
        setAiModelOverride(selectedModel);

        // 3. Initialize new game (generates ID, etc.)
        initializeGame();

        // 4. Set Role Data in RoleStore
        const roleStore = useRoleStore.getState();
        roleStore.setRole(scenario.legacyKey);

        // analysis with/without emphasis
        let analysisData = scenario.powerDistribution;
        if (scenarioOption.disableEmphasis) {
            analysisData = { ...scenario.powerDistribution, dilemmaEmphasis: undefined };
        }
        roleStore.setAnalysis(analysisData);

        // Set default character
        roleStore.setCharacter({
            name: "LabTester",
            gender: "any",
            description: "A lab tester character for model evaluation.",
            age: 30,
            occupation: "Tester",
            background: "Created for debugging purposes",
            isCustom: false
        } as any);
        roleStore.setPlayerName("LabTester");

        // Set role context
        roleStore.setRoleContext(scenario.titleKey, scenario.introKey, scenario.year);
        roleStore.setRoleDescription(scenario.youAreKey);

        // 5. Force Game Phase
        if (setGamePhase) setGamePhase("event");

        // 6. Navigate directly to event screen
        push("/event");
    };

    return (
        <div className="w-full h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8 font-sans">
            <h1 className="text-4xl font-bold mb-8 text-amber-500 tracking-wider">LAB MODE</h1>

            <div className="w-full max-w-md bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700 space-y-6">

                {/* MODEL SELECTOR */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-400 uppercase tracking-widest text-xs">
                        AI Model
                    </label>
                    <div className="relative">
                        <select
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none appearance-none cursor-pointer"
                        >
                            {MODEL_OPTIONS.map((model) => (
                                <option key={model.value} value={model.value}>
                                    {model.label}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                        </div>
                    </div>
                </div>

                {/* SCENARIO SELECTOR */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-400 uppercase tracking-widest text-xs">
                        Scenario / Role
                    </label>
                    <div className="relative">
                        <select
                            value={selectedScenarioIndex}
                            onChange={(e) => setSelectedScenarioIndex(parseInt(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none appearance-none cursor-pointer"
                        >
                            {SCENARIO_OPTIONS.map((opt, idx) => (
                                <option key={`${opt.id}-${idx}`} value={idx}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                        </div>
                    </div>
                </div>

                <div className="pt-4">
                    <button
                        onClick={handleStart}
                        className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 px-6 rounded-lg shadow-lg transform transition hover:scale-105 active:scale-95 text-xl tracking-wide"
                    >
                        ENTER LAB
                    </button>
                </div>

            </div>

            <div className="mt-8 text-slate-500 text-sm max-w-lg text-center font-mono">
                <p>Warning: Lab Mode seeds a "LabTester" character and jumps to the event loop.</p>
                <p>AI model override: <span className="text-amber-500/80">{selectedModel}</span></p>
            </div>
        </div>
    );
};
