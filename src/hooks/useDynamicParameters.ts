// src/hooks/useDynamicParameters.ts
// Manages dynamic parameters that show consequences of player choices
// Parameters are generated after each action and reset at the start of each day

import React, { useState, useCallback, useRef } from "react";
import {
  Users, TrendingUp, TrendingDown, DollarSign, Shield, AlertTriangle,
  Heart, Building, Globe, Leaf, Zap, Target, Scale, Flag, Crown
} from "lucide-react";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useRoleStore } from "../store/roleStore";
import { useCompassStore } from "../store/compassStore";
import { useSettingsStore } from "../store/settingsStore";
import type { ParamItem } from "../components/event/PlayerStatusStrip";

export function useDynamicParameters() {
  const [parameters, setParameters] = useState<ParamItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [animatingIndex, setAnimatingIndex] = useState<number | null>(null);

  // Track if we've generated parameters for the current choice
  const lastGeneratedChoiceRef = useRef<string | null>(null);

  const debugMode = useSettingsStore((s) => s.debugMode);

  // Generate parameters based on last choice
  const generateParameters = useCallback(async () => {
    const { lastChoice, day, totalDays } = useDilemmaStore.getState();
    const { selectedRole, analysis } = useRoleStore.getState();
    const { values: compassValues } = useCompassStore.getState();

    // Only generate if we have a choice and haven't generated for this choice yet
    if (!lastChoice || lastGeneratedChoiceRef.current === lastChoice.id) {
      return;
    }

    setLoading(true);

    try {
      const politicalContext = {
        role: selectedRole,
        systemName: analysis?.systemName,
        day,
        totalDays,
        compassValues
      };

      const response = await fetch("/api/dynamic-parameters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lastChoice,
          politicalContext,
          debug: debugMode
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const aiParameters = Array.isArray(data.parameters) ? data.parameters : [];

      // Convert API response to ParamItem format with proper icons
      const newParameters: ParamItem[] = aiParameters.map((param: any, index: number) => ({
        id: param.id || `param_${Date.now()}_${index}`,
        icon: getIconComponent(param.icon || "AlertTriangle"),
        text: param.text || "Unknown effect",
        tone: param.tone as "up" | "down" | "neutral" || "neutral"
      }));

      // Mark this choice as processed
      lastGeneratedChoiceRef.current = lastChoice.id;

      // Set parameters and trigger staggered animations
      setParameters(newParameters);
      animateParametersSequentially(newParameters.length);

    } catch (error) {
      console.error("Failed to generate dynamic parameters:", error);
      // Fallback to empty parameters on error
      setParameters([]);
    } finally {
      setLoading(false);
    }
  }, [debugMode]);

  // Reset parameters (called when moving to next day)
  const resetParameters = useCallback(() => {
    setParameters([]);
    setAnimatingIndex(null);
    lastGeneratedChoiceRef.current = null;
  }, []);

  // Animate parameters one by one with staggered timing
  const animateParametersSequentially = (count: number) => {
    if (count === 0) return;

    let currentIndex = 0;
    const animateNext = () => {
      if (currentIndex < count) {
        setAnimatingIndex(currentIndex);
        currentIndex++;
        // 500ms delay between each parameter animation
        setTimeout(animateNext, 500);
      } else {
        // Clear animation state once all are shown
        setTimeout(() => setAnimatingIndex(null), 500);
      }
    };

    // Start the sequence after a brief delay
    setTimeout(animateNext, 200);
  };

  // Helper to get React icon component from string name
  const getIconComponent = (iconName: string): React.ReactNode => {
    const iconClass = "w-3.5 h-3.5";
    const iconProps = { className: iconClass, strokeWidth: 2.2 };

    switch (iconName) {
      case "Users":
        return React.createElement(Users, iconProps);
      case "TrendingUp":
        return React.createElement(TrendingUp, iconProps);
      case "TrendingDown":
        return React.createElement(TrendingDown, iconProps);
      case "DollarSign":
        return React.createElement(DollarSign, iconProps);
      case "Shield":
        return React.createElement(Shield, iconProps);
      case "AlertTriangle":
        return React.createElement(AlertTriangle, iconProps);
      case "Heart":
        return React.createElement(Heart, iconProps);
      case "Building":
        return React.createElement(Building, iconProps);
      case "Globe":
        return React.createElement(Globe, iconProps);
      case "Leaf":
        return React.createElement(Leaf, iconProps);
      case "Zap":
        return React.createElement(Zap, iconProps);
      case "Target":
        return React.createElement(Target, iconProps);
      case "Scale":
        return React.createElement(Scale, iconProps);
      case "Flag":
        return React.createElement(Flag, iconProps);
      case "Crown":
        return React.createElement(Crown, iconProps);
      default:
        return React.createElement(AlertTriangle, iconProps);
    }
  };

  return {
    parameters,
    loading,
    animatingIndex,
    generateParameters,
    resetParameters,
    hasParameters: parameters.length > 0,
    lastGeneratedChoiceId: lastGeneratedChoiceRef.current
  };
}