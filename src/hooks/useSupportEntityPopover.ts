// src/hooks/useSupportEntityPopover.ts
// Hook for managing support entity popover state
// Handles opening/closing popovers and ensures only one is open at a time

import { useState, useCallback } from "react";
import { useRoleStore } from "../store/roleStore";
import type { SupportProfile } from "../data/supportProfiles";
import { useLang } from "../i18n/lang";
import { POWER_DISTRIBUTION_TRANSLATIONS } from "../data/powerDistributionTranslations";

export type OpenEntityType = "people" | "challenger" | null;

export type EntityData = {
  name: string;
  profile: SupportProfile;
  currentSupport: number;
} | null;

export function useSupportEntityPopover() {
  const [openEntity, setOpenEntity] = useState<OpenEntityType>(null);
  const lang = useLang();

  // Get support profiles from roleStore
  const supportProfiles = useRoleStore((s) => s.supportProfiles);
  const challengerSeat = useRoleStore((s) => s.analysis?.challengerSeat);

  // Open popover for a specific entity
  const openPopover = useCallback((entityType: "people" | "challenger") => {
    setOpenEntity(entityType);
  }, []);

  // Close any open popover
  const closePopover = useCallback(() => {
    setOpenEntity(null);
  }, []);

  // Toggle popover for a specific entity
  const togglePopover = useCallback((entityType: "people" | "challenger") => {
    setOpenEntity((current) => (current === entityType ? null : entityType));
  }, []);

  // Get entity data for the currently open popover
  const getEntityData = useCallback(
    (entityType: "people" | "challenger", currentSupport: number): EntityData => {
      if (!supportProfiles) return null;

      if (entityType === "people") {
        const profile = supportProfiles.people;
        if (!profile) return null;
        return {
          name: lang("SUPPORT_THE_PEOPLE"),
          profile,
          currentSupport,
        };
      }

      if (entityType === "challenger") {
        const profile = supportProfiles.challenger;
        
        // Helper function to translate challenger seat name
        const translateChallengerName = (name: string): string => {
          // Check all predefined role translations for a matching holder name
          for (const roleTranslations of Object.values(POWER_DISTRIBUTION_TRANSLATIONS)) {
            const holderTranslation = roleTranslations.holders[name];
            if (holderTranslation) {
              return lang(holderTranslation.name);
            }
          }
          // If no translation found, return name as-is (for AI-generated roles)
          return name;
        };
        
        const name = challengerSeat?.name
          ? translateChallengerName(challengerSeat.name)
          : lang("OPPOSITION");
        if (!profile) return null;
        return {
          name,
          profile,
          currentSupport,
        };
      }

      return null;
    },
    [supportProfiles, challengerSeat, lang]
  );

  return {
    openEntity,
    openPopover,
    closePopover,
    togglePopover,
    getEntityData,
  };
}
