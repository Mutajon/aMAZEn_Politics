// src/data/powerDistributionTranslations.ts
// Translation mappings for power distribution data in predefined roles
// Updated: 2026-01-03 - Added Athens translations

export const POWER_DISTRIBUTION_TRANSLATIONS: Record<string, {
  systemName: string;
  systemDesc: string;
  flavor: string;
  holders: Record<string, { name: string; note: string }>;
}> = {
  "athens_431": {
    systemName: "ATHENS_SYSTEM_NAME",
    systemDesc: "ATHENS_SYSTEM_DESC",
    flavor: "ATHENS_FLAVOR",
    holders: {
      "Assembly (Ekklesia)": {
        name: "ATHENS_HOLDER_ASSEMBLY_NAME",
        note: "ATHENS_HOLDER_ASSEMBLY_NOTE"
      },
      "Strategos (Generals)": {
        name: "ATHENS_HOLDER_GENERALS_NAME",
        note: "ATHENS_HOLDER_GENERALS_NOTE"
      },
      "Council of 500 (Boule)": {
        name: "ATHENS_HOLDER_COUNCIL_NAME",
        note: "ATHENS_HOLDER_COUNCIL_NOTE"
      },
      "Law Courts (Dikasteria)": {
        name: "ATHENS_HOLDER_COURTS_NAME",
        note: "ATHENS_HOLDER_COURTS_NOTE"
      },
      "Wealthy Elite (Liturgy Payers)": {
        name: "ATHENS_HOLDER_WEALTH_NAME",
        note: "ATHENS_HOLDER_WEALTH_NOTE"
      }
    }
  },

  "railroad_1877": {
    systemName: "RAILROAD_SYSTEM_NAME",
    systemDesc: "RAILROAD_SYSTEM_DESC",
    flavor: "RAILROAD_FLAVOR",
    holders: {
      "Railroad Owners": {
        name: "RAILROAD_HOLDER_OWNERS_NAME",
        note: "RAILROAD_HOLDER_OWNERS_NOTE"
      },
      "State Executives": {
        name: "RAILROAD_HOLDER_EXECUTIVES_NAME",
        note: "RAILROAD_HOLDER_EXECUTIVES_NOTE"
      },
      "Coercive Force": {
        name: "RAILROAD_HOLDER_COERCIVE_NAME",
        note: "RAILROAD_HOLDER_COERCIVE_NOTE"
      },
      "Workers & Crowds": {
        name: "RAILROAD_HOLDER_WORKERS_NAME",
        note: "RAILROAD_HOLDER_WORKERS_NOTE"
      },
      "Local Newspapers": {
        name: "RAILROAD_HOLDER_NEWSPAPERS_NAME",
        note: "RAILROAD_HOLDER_NEWSPAPERS_NOTE"
      }
    }
  },

  "namek_2099": {
    systemName: "NAMEK_SYSTEM_NAME",
    systemDesc: "NAMEK_SYSTEM_DESC",
    flavor: "NAMEK_FLAVOR",
    holders: {
      "Demos (Citizens)": {
        name: "NAMEK_HOLDER_DEMOS_NAME",
        note: "NAMEK_HOLDER_DEMOS_NOTE"
      },
      "Media (Journalists)": {
        name: "NAMEK_HOLDER_MEDIA_NAME",
        note: "NAMEK_HOLDER_MEDIA_NOTE"
      },
      "Wealth (Owners)": {
        name: "NAMEK_HOLDER_WEALTH_NAME",
        note: "NAMEK_HOLDER_WEALTH_NOTE"
      },
      "Ideology (Normative Frames)": {
        name: "NAMEK_HOLDER_IDEOLOGY_NAME",
        note: "NAMEK_HOLDER_IDEOLOGY_NOTE"
      },
      "Police (Civic Security)": {
        name: "NAMEK_HOLDER_POLICE_NAME",
        note: "NAMEK_HOLDER_POLICE_NOTE"
      }
    }
  }
};

/**
 * Helper function to translate power distribution data for a predefined role
 */
export function translatePowerDistribution(
  roleId: string,
  powerDistribution: any,
  lang: (key: string) => string
): any {
  const translations = POWER_DISTRIBUTION_TRANSLATIONS[roleId];

  if (!translations) {
    // If no translations exist (custom role), return as-is
    return powerDistribution;
  }

  return {
    ...powerDistribution,
    systemName: lang(translations.systemName),
    systemDesc: lang(translations.systemDesc),
    flavor: lang(translations.flavor),
    holders: powerDistribution.holders.map((holder: any) => {
      const holderTranslation = translations.holders[holder.name];
      if (holderTranslation) {
        return {
          ...holder,
          name: lang(holderTranslation.name),
          note: lang(holderTranslation.note)
        };
      }
      return holder;
    }),
    challengerSeat: powerDistribution.challengerSeat ? {
      ...powerDistribution.challengerSeat,
      name: lang(translations.holders[powerDistribution.challengerSeat.name]?.name || powerDistribution.challengerSeat.name)
    } : undefined
  };
}
