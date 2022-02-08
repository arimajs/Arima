import type { Snowflake } from 'discord.js';
import type { ObjectId } from '@mikro-orm/mongodb';
import { SerializedPrimaryKey, PrimaryKey, Entity, Property, OptionalProps } from '@mikro-orm/core';

export enum Rank {
	Beginner,
	Experienced,
	Master,
	Divine,
	Legendary
}

const ranks = new Map([
	[0, Rank.Beginner],
	[10, Rank.Experienced],
	[20, Rank.Master],
	[30, Rank.Divine],
	[40, Rank.Legendary]
]);

@Entity()
export class Member {
	public [OptionalProps]?: Exclude<keyof Member, 'userId' | 'guildId'>;

	@PrimaryKey()
	public _id!: ObjectId;

	@SerializedPrimaryKey()
	public id!: string;

	@Property({ type: 'string' })
	public userId!: Snowflake;

	@Property({ type: 'string' })
	public guildId!: Snowflake;

	@Property()
	public points: number = 0;

	@Property()
	public gamesPlayed: number = 0;

	@Property()
	public gamesWon: number = 0;

	@Property({ persist: false })
	public get level() {
		return Math.floor(0.2 * Math.sqrt(this.points));
	}

	@Property({ persist: false })
	public get rank() {
		const flooredTen = Math.floor(this.gamesWon / 10) * 10;
		return ranks.get(flooredTen) ?? Rank.Legendary;
	}
}
