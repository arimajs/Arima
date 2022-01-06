import type { Snowflake } from 'discord.js';
import { Leaderboard } from '#game/Leaderboard';

export class StreakCounter extends Leaderboard {
	public override inc(key: Snowflake) {
		const points = 0;

		// Iterate through each player in the leaderboard, and remove their
		// streak if they are not `key`. If another player's streak is
		// incremented, the others obviously don't have a streak anymore.
		this.forEach((points, id) => (id === key ? (points = super.inc(id)) : super.inc(id, -points)));

		return points;
	}

	public removeAll(): void {
		// If nobody guesses correctly, everybody's streak is ruined.
		this.forEach((points, id) => super.inc(id, -points));
	}
}
