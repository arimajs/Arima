import { ordinal, pluralize } from '#utils/common';
import { Collection, type Snowflake } from 'discord.js';
import { userMention } from '@discordjs/builders';

export class Leaderboard extends Collection<Snowflake, number> {
	public get leader() {
		return this.reduce((acc, points, id) => {
			return !acc || points > acc[1] ? [id, points] as [Snowflake, number] : acc;
		}, null as [Snowflake, number] | null);
	}

	public inc(key: Snowflake, value = 1) {
		let existingEntry = this.get(key) ?? 0;
		this.set(key, (existingEntry += value));
		return existingEntry;
	}

	public compute() {
		const entries = [...this.sorted((a, b) => b - a).entries()].slice(0, 10);
		const display = entries
			.map(([id, points], idx) => `${ordinal(idx + 1)} Place • ${userMention(id)} • ${pluralize('point', points)}`)
			.join('\n');

		return display || "Nobody's on the leaderboard!";
	}
}
