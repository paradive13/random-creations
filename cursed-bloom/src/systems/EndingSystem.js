// EndingSystem.js — Determines which of the 4 endings to trigger
export const ENDINGS = {
  TRUE: 'true',
  SECRET: 'secret',
  BAD: 'bad',
  CORRUPTED: 'corrupted',
};

export class EndingSystem {
  constructor() {
    this.deaths = 0;
    this.allLoreCollected = false;
  }

  recordDeath() { this.deaths++; }
  setAllLoreCollected(v) { this.allLoreCollected = v; }

  determineEnding(sanity, curseStage) {
    // Bad ending: died 3+ times or sanity hit 0
    if (this.deaths >= 3 || sanity <= 0) return ENDINGS.BAD;

    // Corrupted: picked flower in stage 4
    if (curseStage >= 4) return ENDINGS.CORRUPTED;

    // Secret: all lore collected
    if (this.allLoreCollected) return ENDINGS.SECRET;

    // True ending
    return ENDINGS.TRUE;
  }

  getEndingContent(ending) {
    switch (ending) {
      case ENDINGS.TRUE: return {
        title: 'Light Has Returned.',
        subtitle: 'The curse is broken. They are free.',
        color: '#fffbe6',
        bg: '#0a0a1a',
        message: 'You found the flower. The darkness retreats. Sunlight fills rooms long forgotten. The monsters sigh — not in rage, but in relief. They are finally free.',
        peaceful: true,
      };
      case ENDINGS.SECRET: return {
        title: 'They Are Free Now.',
        subtitle: 'You heard every story. You understood.',
        color: '#e6f0ff',
        bg: '#050a1a',
        message: 'Dr. Harrow\'s ghost appears. "Thank you," he whispers. "I tried for decades. You did it in one night." Each monster appears briefly in their human form — then fades, smiling.',
        peaceful: true,
      };
      case ENDINGS.BAD: return {
        title: 'The Curse Found Its Next Host.',
        subtitle: 'You were not the last.',
        color: '#ffeeee',
        bg: '#1a0000',
        message: 'You open your eyes. But something is wrong with your hands. The house looks different from this angle. You understand now — you were never leaving. You are what comes next.',
        peaceful: false,
      };
      case ENDINGS.CORRUPTED: return {
        title: 'Some Curses Cannot Be Broken.',
        subtitle: 'It was always too late.',
        color: '#550000',
        bg: '#0a0000',
        message: 'The flower begins to heal the house. Light flickers in. Then — darkness floods back, stronger. The flower blackens and dies in your hand. The house seals. There is no exit.',
        peaceful: false,
      };
    }
  }
}
