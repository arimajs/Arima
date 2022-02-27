import { ordinal, prefixAndPluralize } from '#utils/common';
import { Collection, type Snowflake } from 'discord.js';
import { userMention } from '@discordjs/builders';

export class Leaderboard extends Collection<Snowflake, number> {
	public get leader() {
		// Sort by points (ascending)
		const sorted = this.sorted((a, b) => b - a);
		return [...sorted.entries()][0];
	}

	public inc(key: Snowflake, value = 1) {
		let existingEntry = this.get(key) ?? 0;
		this.set(key, (existingEntry += value));
		return existingEntry;
	}

	public compute() {
		const entries = [...this.sorted((a, b) => b - a).entries()].slice(0, 10);
		const display = entries
			.map(([id, points], idx) => `${ordinal(idx + 1)} Place • ${userMention(id)} • ${prefixAndPluralize('point', points)}`)
			.join('\n');

		return display || "Nobody's on the leaderboard!";
	}
}
