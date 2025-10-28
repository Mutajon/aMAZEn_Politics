// src/data/predefinedCharacters.ts
// Predefined character names and descriptions for the 10 preset roles
// This eliminates the need for AI processing when players choose these roles

export interface CharacterOption {
  name: string;
  prompt: string; // Description for avatar generation and character background
}

export interface RoleCharacters {
  male: CharacterOption;
  female: CharacterOption;
  any: CharacterOption;
}

export const PREDEFINED_CHARACTERS: Record<string, RoleCharacters> = {
  "Athens — The Day Democracy Died (-404)": {
    male: {
      name: "Theramenes",
      prompt: "A weathered Athenian citizen with salt-and-pepper beard, wearing a torn chiton, eyes filled with loss and determination, standing amid the ruins of democracy"
    },
    female: {
      name: "Lysandra",
      prompt: "An Athenian woman in simple peplos robes, dark hair covered with a veil, expression resolute yet sorrowful, representing those who survived Athens' fall"
    },
    any: {
      name: "Nikias",
      prompt: "A middle-aged Athenian with weary eyes, wearing travel-worn himation, holding a walking staff, embodying the spirit of a fallen democracy"
    }
  },

  "Alexandria — Fire over the Nile (-48)": {
    male: {
      name: "Apollonios",
      prompt: "A Greek-Egyptian scholar in linen robes with papyrus scrolls, worried expression as smoke rises behind him, caught between warring powers and burning knowledge"
    },
    female: {
      name: "Berenice",
      prompt: "An educated Alexandrian woman in Greco-Egyptian dress with jewelry, intelligent eyes reflecting firelight, torn between loyalty and survival"
    },
    any: {
      name: "Ptolemaios",
      prompt: "A learned librarian in flowing robes with ink-stained fingers, desperate expression as the great Library burns, embodying the clash of knowledge and war"
    }
  },

  "Florence — The Fire and the Faith (1494)": {
    male: {
      name: "Lorenzo",
      prompt: "A Florentine council member in rich Renaissance attire with fur trim, conflicted expression, standing before the burning pyre of vanities with a rosary in hand"
    },
    female: {
      name: "Caterina",
      prompt: "A Renaissance Florentine woman in elegant dress with pearl necklace, eyes reflecting both faith and doubt, representing the city torn between art and piety"
    },
    any: {
      name: "Alessandro",
      prompt: "A thoughtful Florentine in merchant's robes with a ledger, watching Savonarola's followers with concern, embodying the tension between commerce and conviction"
    }
  },

  "North America — The First Encounter (1607)": {
    male: {
      name: "Powhatan",
      prompt: "A paramount chief in deerskin mantle with shell beads, feathered headdress, weathered face showing wisdom and caution, gazing toward distant wooden ships"
    },
    female: {
      name: "Pocahontas",
      prompt: "A young indigenous leader's daughter in decorated buckskin dress with intricate beadwork, curious yet wary expression, standing at the threshold of two worlds"
    },
    any: {
      name: "Opchanacanough",
      prompt: "A tribal elder in traditional dress with face paint and copper ornaments, eyes reflecting both the forest's ancient ways and the newcomers' strange ships"
    }
  },

  "Japan — The Land at War's End (1600)": {
    male: {
      name: "Takeda Nobushige",
      prompt: "A Japanese clan lord in samurai armor with mon crest, katana at his side, stern face showing the weight of choosing sides before Sekigahara"
    },
    female: {
      name: "Hōjō Masako",
      prompt: "A noble Japanese woman in formal kimono with elaborate hairstyle, intelligent eyes reflecting strategic thinking, wielding influence in a warrior's world"
    },
    any: {
      name: "Shimazu Yoshihiro",
      prompt: "A warlord in battle-worn armor with clan banner, weathered face showing years of war, standing at the crossroads of Japan's final great battle"
    }
  },

  "Haiti — The Island in Revolt (1791)": {
    male: {
      name: "Jean-Baptiste",
      prompt: "A mixed-race overseer in colonial clothes torn between two worlds, machete at his belt, eyes showing conflict between survival and justice on a burning island"
    },
    female: {
      name: "Cécile",
      prompt: "A Haitian woman of mixed heritage in practical dress, determined expression, caught between the plantation masters and the rebels' drums echoing through the night"
    },
    any: {
      name: "Toussaint",
      prompt: "A person of African and French descent in overseer's attire, standing amid sugar cane fields with flames on the horizon, embodying revolution's difficult choices"
    }
  },

  "Russia — The Throne Crumbles (1917)": {
    male: {
      name: "Nikolai Alexandrovich",
      prompt: "A Tsar in military uniform with medals and epaulettes, troubled expression, imperial bearing undermined by the weight of a crumbling empire and rising crowds"
    },
    female: {
      name: "Anastasia Nikolaevna",
      prompt: "A Russian noblewoman in elegant dress with fur stole, eyes reflecting both privilege and fear as the old world dissolves into revolution"
    },
    any: {
      name: "Dmitri Kerensky",
      prompt: "A Russian leader in formal suit with Duma pin, exhausted expression, caught between the Tsar's fading authority and the workers' rising councils"
    }
  },

  "India — The Midnight of Freedom (1947)": {
    male: {
      name: "Rajendra Singh",
      prompt: "An Indian district officer in British colonial uniform, turban and serious expression, standing amid chaos as partition tears his town apart along invisible lines"
    },
    female: {
      name: "Priya Sharma",
      prompt: "An Indian administrator in sari with documents, determined face showing resolve to keep peace while flames of communal violence rise around her"
    },
    any: {
      name: "Arjun Patel",
      prompt: "A civil servant in khaki uniform with police insignia, weary eyes having seen too much violence, trying to hold together a fracturing community at midnight"
    }
  },

  "South Africa — The End of Apartheid (1990)": {
    male: {
      name: "Pieter van Rensburg",
      prompt: "A South African police commander in blue uniform with insignia, conflicted expression, standing between the old order's demands and the rising tide of change"
    },
    female: {
      name: "Thandi Mkhize",
      prompt: "A Black South African police official in uniform, determined face showing strength despite working within an unjust system nearing its end"
    },
    any: {
      name: "Johan de Klerk",
      prompt: "A senior commander in SAPS uniform with rank insignia, weathered face showing years of enforcing apartheid, now facing cameras and crowds demanding freedom"
    }
  },

  "Mars Colony — The Red Frontier (2179)": {
    male: {
      name: "Kenji Chen-Martinez",
      prompt: "An elected Mars colony leader in utilitarian jumpsuit with Earth and Mars patches, confident yet burdened expression, standing in a habitat dome with red desert beyond"
    },
    female: {
      name: "Amara Okonkwo-Singh",
      prompt: "A Mars governor in practical colony uniform with communication devices, multicultural features, determined eyes reflecting both survival instinct and freedom's dream"
    },
    any: {
      name: "Zara Al-Rahman",
      prompt: "A future colony administrator in high-tech suit with holographic displays, diverse heritage visible in features, balancing Earth's control against Mars' independence"
    }
  }
};

// Helper function to get predefined characters for a role
export function getPredefinedCharacters(roleLabel: string): RoleCharacters | null {
  return PREDEFINED_CHARACTERS[roleLabel] || null;
}

// Helper function to check if a role has predefined characters
export function hasPredefinedCharacters(roleLabel: string): boolean {
  return roleLabel in PREDEFINED_CHARACTERS;
}
