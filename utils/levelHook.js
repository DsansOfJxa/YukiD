import { xpRange, findLevel } from './tools.js';
import { checkAchievements } from '../cmds/economia/rpg_adventure.js';


export default async (m) => {
  try {
    const user = global?.db?.data?.users?.[m.sender];
    if (!user) return;
    const before = user.level || 0;
    const currentLevel = findLevel(user.exp || 0, global.multiplier || 2);

    if (currentLevel > before) {
      user.level = currentLevel;
      const coinBonus = Math.floor(Math.random() * (8000 - 5000 + 1)) + 5000;
      const expBonus = Math.floor(Math.random() * (500 - 100 + 1)) + 100;
      if (user.level % 5 === 0) {
        user.coins = (user.coins || 0) + coinBonus;
        user.exp = (user.exp || 0) + expBonus;
      }
      // Auto-check achievements on level up
      try { checkAchievements(m.sender); } catch {}
    }
  } catch {}
};
