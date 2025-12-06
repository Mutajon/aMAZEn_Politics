// src/data/powerDistributionTranslations.ts
// Translation mappings for power distribution data in predefined roles

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
  
  "alexandria_48": {
    systemName: "ALEXANDRIA_SYSTEM_NAME",
    systemDesc: "ALEXANDRIA_SYSTEM_DESC",
    flavor: "ALEXANDRIA_FLAVOR",
    holders: {
      "Roman General & Legions": {
        name: "ALEXANDRIA_HOLDER_ROMAN_NAME",
        note: "ALEXANDRIA_HOLDER_ROMAN_NOTE"
      },
      "Egyptian Army & Palace Guards": {
        name: "ALEXANDRIA_HOLDER_EGYPTIAN_NAME",
        note: "ALEXANDRIA_HOLDER_EGYPTIAN_NOTE"
      },
      "Royal Court (Cleopatra/Ptolemy)": {
        name: "ALEXANDRIA_HOLDER_COURT_NAME",
        note: "ALEXANDRIA_HOLDER_COURT_NOTE"
      },
      "City Wealth & Grain Merchants": {
        name: "ALEXANDRIA_HOLDER_WEALTH_NAME",
        note: "ALEXANDRIA_HOLDER_WEALTH_NOTE"
      },
      "Alexandrian Crowd & Dockworkers": {
        name: "ALEXANDRIA_HOLDER_CROWD_NAME",
        note: "ALEXANDRIA_HOLDER_CROWD_NOTE"
      }
    }
  },
  
  "florence_1494": {
    systemName: "FLORENCE_SYSTEM_NAME",
    systemDesc: "FLORENCE_SYSTEM_DESC",
    flavor: "FLORENCE_FLAVOR",
    holders: {
      "Ideology/Religious (Savonarola & Friars)": {
        name: "FLORENCE_HOLDER_RELIGIOUS_NAME",
        note: "FLORENCE_HOLDER_RELIGIOUS_NOTE"
      },
      "Legislative (Great Council)": {
        name: "FLORENCE_HOLDER_LEGISLATIVE_NAME",
        note: "FLORENCE_HOLDER_LEGISLATIVE_NOTE"
      },
      "Executive (City Leaders & Chief Magistrate)": {
        name: "FLORENCE_HOLDER_EXECUTIVE_NAME",
        note: "FLORENCE_HOLDER_EXECUTIVE_NOTE"
      },
      "Wealth (Bankers & Guild Elders)": {
        name: "FLORENCE_HOLDER_WEALTH_NAME",
        note: "FLORENCE_HOLDER_WEALTH_NOTE"
      },
      "Judicial/Police": {
        name: "FLORENCE_HOLDER_JUDICIAL_NAME",
        note: "FLORENCE_HOLDER_JUDICIAL_NOTE"
      }
    }
  },

  "telaviv_2025": {
    systemName: "TELAVIV_SYSTEM_NAME",
    systemDesc: "TELAVIV_SYSTEM_DESC",
    flavor: "TELAVIV_FLAVOR",
    holders: {
      "Executive (University Mgmt & State)": {
        name: "TELAVIV_HOLDER_EXECUTIVE_NAME",
        note: "TELAVIV_HOLDER_EXECUTIVE_NOTE"
      },
      "Demos (Students)": {
        name: "TELAVIV_HOLDER_DEMOS_NAME",
        note: "TELAVIV_HOLDER_DEMOS_NOTE"
      },
      "Ideology (Political Factions)": {
        name: "TELAVIV_HOLDER_IDEOLOGY_NAME",
        note: "TELAVIV_HOLDER_IDEOLOGY_NOTE"
      },
      "Wealth (Donors/Parents)": {
        name: "TELAVIV_HOLDER_WEALTH_NAME",
        note: "TELAVIV_HOLDER_WEALTH_NOTE"
      },
      "General Population (Israeli Society/Media)": {
        name: "TELAVIV_HOLDER_MEDIA_NAME",
        note: "TELAVIV_HOLDER_MEDIA_NOTE"
      }
    }
  },

  "north_america_1607": {
    systemName: "NORTH_AMERICA_SYSTEM_NAME",
    systemDesc: "NORTH_AMERICA_SYSTEM_DESC",
    flavor: "NORTH_AMERICA_FLAVOR",
    holders: {
      "Executive (Paramount Chief)": {
        name: "NORTH_AMERICA_HOLDER_CHIEF_NAME",
        note: "NORTH_AMERICA_HOLDER_CHIEF_NOTE"
      },
      "Coercive Force (War Captains & Warriors)": {
        name: "NORTH_AMERICA_HOLDER_WARRIORS_NAME",
        note: "NORTH_AMERICA_HOLDER_WARRIORS_NOTE"
      },
      "Council of Chiefs/Elders": {
        name: "NORTH_AMERICA_HOLDER_COUNCIL_NAME",
        note: "NORTH_AMERICA_HOLDER_COUNCIL_NOTE"
      },
      "Ideology/Religious (Spiritual Advisers)": {
        name: "NORTH_AMERICA_HOLDER_SPIRITUAL_NAME",
        note: "NORTH_AMERICA_HOLDER_SPIRITUAL_NOTE"
      },
      "Wealth (Food/Trade Gatekeepers)": {
        name: "NORTH_AMERICA_HOLDER_WEALTH_NAME",
        note: "NORTH_AMERICA_HOLDER_WEALTH_NOTE"
      }
    }
  },
  
  "japan_1600": {
    systemName: "JAPAN_SYSTEM_NAME",
    systemDesc: "JAPAN_SYSTEM_DESC",
    flavor: "JAPAN_FLAVOR",
    holders: {
      "Coercive Force (Armies & Warlords)": {
        name: "JAPAN_HOLDER_ARMIES_NAME",
        note: "JAPAN_HOLDER_ARMIES_NOTE"
      },
      "Executive (Coalition Chiefs)": {
        name: "JAPAN_HOLDER_CHIEFS_NAME",
        note: "JAPAN_HOLDER_CHIEFS_NOTE"
      },
      "Wealth (Rice Yields & Merchants)": {
        name: "JAPAN_HOLDER_WEALTH_NAME",
        note: "JAPAN_HOLDER_WEALTH_NOTE"
      },
      "Bureaucracy (Clan Stewards)": {
        name: "JAPAN_HOLDER_BUREAUCRACY_NAME",
        note: "JAPAN_HOLDER_BUREAUCRACY_NOTE"
      },
      "Ideology/Religious (Imperial Court & Temples)": {
        name: "JAPAN_HOLDER_RELIGIOUS_NAME",
        note: "JAPAN_HOLDER_RELIGIOUS_NOTE"
      }
    }
  },
  
  "haiti_1791": {
    systemName: "HAITI_SYSTEM_NAME",
    systemDesc: "HAITI_SYSTEM_DESC",
    flavor: "HAITI_FLAVOR",
    holders: {
      "Rebel Slave Armies (Coercive Force)": {
        name: "HAITI_HOLDER_REBELS_NAME",
        note: "HAITI_HOLDER_REBELS_NOTE"
      },
      "Colonial Militias & Troops (Coercive Force)": {
        name: "HAITI_HOLDER_MILITIAS_NAME",
        note: "HAITI_HOLDER_MILITIAS_NOTE"
      },
      "Planter Elite (Wealth)": {
        name: "HAITI_HOLDER_PLANTERS_NAME",
        note: "HAITI_HOLDER_PLANTERS_NOTE"
      },
      "Colonial Governor & Bureaucracy (Executive)": {
        name: "HAITI_HOLDER_GOVERNOR_NAME",
        note: "HAITI_HOLDER_GOVERNOR_NOTE"
      },
      "Vodou & Rebel Organizers (Ideology/Religious)": {
        name: "HAITI_HOLDER_VODOU_NAME",
        note: "HAITI_HOLDER_VODOU_NOTE"
      }
    }
  },
  
  "russia_1917": {
    systemName: "RUSSIA_SYSTEM_NAME",
    systemDesc: "RUSSIA_SYSTEM_DESC",
    flavor: "RUSSIA_FLAVOR",
    holders: {
      "Coercive Force (Army & Garrison)": {
        name: "RUSSIA_HOLDER_ARMY_NAME",
        note: "RUSSIA_HOLDER_ARMY_NOTE"
      },
      "Executive (Tsar)": {
        name: "RUSSIA_HOLDER_TSAR_NAME",
        note: "RUSSIA_HOLDER_TSAR_NOTE"
      },
      "Demos (Workers' & Soldiers' Councils)": {
        name: "RUSSIA_HOLDER_DEMOS_NAME",
        note: "RUSSIA_HOLDER_DEMOS_NOTE"
      },
      "Legislative (Duma Leaders)": {
        name: "RUSSIA_HOLDER_DUMA_NAME",
        note: "RUSSIA_HOLDER_DUMA_NOTE"
      },
      "Wealth (Nobles & Big Industry)": {
        name: "RUSSIA_HOLDER_WEALTH_NAME",
        note: "RUSSIA_HOLDER_WEALTH_NOTE"
      }
    }
  },
  
  "india_1947": {
    systemName: "INDIA_SYSTEM_NAME",
    systemDesc: "INDIA_SYSTEM_DESC",
    flavor: "INDIA_FLAVOR",
    holders: {
      "Coercive Force": {
        name: "INDIA_HOLDER_COERCIVE_NAME",
        note: "INDIA_HOLDER_COERCIVE_NOTE"
      },
      "Ideology/Religious": {
        name: "INDIA_HOLDER_RELIGIOUS_NAME",
        note: "INDIA_HOLDER_RELIGIOUS_NOTE"
      },
      "Executive": {
        name: "INDIA_HOLDER_EXECUTIVE_NAME",
        note: "INDIA_HOLDER_EXECUTIVE_NOTE"
      },
      "Demos": {
        name: "INDIA_HOLDER_DEMOS_NAME",
        note: "INDIA_HOLDER_DEMOS_NOTE"
      },
      "Media/Platforms": {
        name: "INDIA_HOLDER_MEDIA_NAME",
        note: "INDIA_HOLDER_MEDIA_NOTE"
      }
    }
  },
  
  "south_africa_1990": {
    systemName: "SOUTH_AFRICA_SYSTEM_NAME",
    systemDesc: "SOUTH_AFRICA_SYSTEM_DESC",
    flavor: "SOUTH_AFRICA_FLAVOR",
    holders: {
      "Executive": {
        name: "SOUTH_AFRICA_HOLDER_EXECUTIVE_NAME",
        note: "SOUTH_AFRICA_HOLDER_EXECUTIVE_NOTE"
      },
      "Coercive Force": {
        name: "SOUTH_AFRICA_HOLDER_COERCIVE_NAME",
        note: "SOUTH_AFRICA_HOLDER_COERCIVE_NOTE"
      },
      "Demos": {
        name: "SOUTH_AFRICA_HOLDER_DEMOS_NAME",
        note: "SOUTH_AFRICA_HOLDER_DEMOS_NOTE"
      },
      "Wealth": {
        name: "SOUTH_AFRICA_HOLDER_WEALTH_NAME",
        note: "SOUTH_AFRICA_HOLDER_WEALTH_NOTE"
      },
      "Media/Platforms": {
        name: "SOUTH_AFRICA_HOLDER_MEDIA_NAME",
        note: "SOUTH_AFRICA_HOLDER_MEDIA_NOTE"
      }
    }
  },
  
  "mars_2179": {
    systemName: "MARS_SYSTEM_NAME",
    systemDesc: "MARS_SYSTEM_DESC",
    flavor: "MARS_FLAVOR",
    holders: {
      "Executive": {
        name: "MARS_HOLDER_EXECUTIVE_NAME",
        note: "MARS_HOLDER_EXECUTIVE_NOTE"
      },
      "Science/Philosophy": {
        name: "MARS_HOLDER_SCIENCE_NAME",
        note: "MARS_HOLDER_SCIENCE_NOTE"
      },
      "Wealth": {
        name: "MARS_HOLDER_WEALTH_NAME",
        note: "MARS_HOLDER_WEALTH_NOTE"
      },
      "Legislative": {
        name: "MARS_HOLDER_LEGISLATIVE_NAME",
        note: "MARS_HOLDER_LEGISLATIVE_NOTE"
      },
      "Coercive Force": {
        name: "MARS_HOLDER_COERCIVE_NAME",
        note: "MARS_HOLDER_COERCIVE_NOTE"
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

