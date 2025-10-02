// src/data/predefinedCharacters.ts
// Predefined character names and descriptions for the four preset roles
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
  "Citizen of the Assembly in Classical Athens": {
    male: {
      name: "Cleisthenes Aristides",
      prompt: "A thoughtful Athenian citizen with weathered hands from his trade, olive-tanned skin, intelligent brown eyes, and a simple chiton draped over his frame, standing with the dignity of democratic participation"
    },
    female: {
      name: "Aspasia Demokratia",
      prompt: "A sharp-minded Athenian woman with keen dark eyes, wearing elegant peplos robes, her hair braided with olive leaves, embodying the wisdom and civic virtue valued in the golden age of Athens"
    },
    any: {
      name: "Alexios Demosthenes",
      prompt: "An eloquent citizen of Athens with expressive features, wearing traditional himation, with scrolls tucked under one arm, representing the ideals of democratic discourse and civic engagement"
    }
  },

  "Senator of the Roman Republic": {
    male: {
      name: "Marcus Aurelius Virtus",
      prompt: "A distinguished Roman senator with a strong jawline, wearing a white toga with purple stripe, a golden laurel wreath upon his brow, embodying the gravitas and authority of the Republic"
    },
    female: {
      name: "Livia Cornelia Magna",
      prompt: "A noble Roman matron with regal bearing, wearing elegant stola and palla, intricate braided hair with golden ornaments, her presence commanding respect in the halls of power"
    },
    any: {
      name: "Gaius Cicero Republicanus",
      prompt: "A learned Roman citizen with thoughtful eyes, wearing senatorial toga, holding a wax tablet, representing the intellectual foundation and civic duty of the Republic"
    }
  },

  "Emperor of Tang China": {
    male: {
      name: "Li Longwei",
      prompt: "A majestic Chinese emperor with silk robes of imperial yellow and dragon motifs, wearing an ornate golden crown with jade ornaments, his bearing radiating the mandate of heaven and absolute authority"
    },
    female: {
      name: "Wu Tianming",
      prompt: "An empress of Tang China in elaborate phoenix-decorated robes, with intricate hair ornaments of gold and jade, her expression wise and commanding, embodying imperial grace and power"
    },
    any: {
      name: "Zhang Tianzhi",
      prompt: "A Tang dynasty ruler in flowing imperial robes with cloud and dragon patterns, wearing the traditional crown of the Son of Heaven, representing divine mandate and scholarly wisdom"
    }
  },

  "Chancellor of Modern Germany": {
    male: {
      name: "Friedrich Demokratisch",
      prompt: "A modern German statesman in a well-tailored dark suit and tie, with steel-rimmed glasses, salt-and-pepper hair neatly styled, his demeanor professional and approachable, embodying democratic leadership"
    },
    female: {
      name: "Angela Fortschritt",
      prompt: "A composed German chancellor in a professional blazer, with short styled hair and confident expression, representing competent democratic governance and European leadership"
    },
    any: {
      name: "Wolfgang Bundesrepublik",
      prompt: "A thoughtful German political leader in contemporary business attire, with an expression of careful deliberation, representing the principles of consensus-building and democratic compromise"
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