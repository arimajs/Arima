import type { Snowflake } from 'discord.js';
import { Leaderboard } from '#game/Leaderboard';

export class StreakCounter extends Leaderboard {
	public incStreak(...keys: Snowflake[]) {
		// Iterate through each player in the leaderboard, and remove their
		// streak if they are not `key`. If another player's streak is
		// incremented, the others obviously don't have a streak anymore.
		for (const [id, points] of this.entries()) {
			this.inc(id, keys.includes(id) ? -points : 1);
		}
	}

	public removeAll(): void {
		// If nobody guesses correctly, everybody's streak is ruined.
		for (const [id, points] of this.entries()) {
			this.inc(id, -points);
		}
	}
}
