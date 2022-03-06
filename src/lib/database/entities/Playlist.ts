import type { HexColorString, Snowflake } from 'discord.js';
import { SerializedPrimaryKey, PrimaryKey, Entity, Property, OptionalProps, Embedded, Embeddable } from '@mikro-orm/core';
import { ObjectId } from '@mikro-orm/mongodb';

@Embeddable()
export class Track {
	@Property()
	public track!: string;

	@Property()
	public thumbnail?: string;

	@Property()
	public color?: HexColorString;
}

@Entity()
export class Playlist {
	public [OptionalProps]?: 'track' | 'createdAt';

	@PrimaryKey()
	public _id!: ObjectId;

	@SerializedPrimaryKey()
	public id!: string;

	@Property({ type: 'string' })
	public creator!: Snowflake;

	@Property()
	public name!: string;

	@Embedded(() => Track, { array: true })
	public tracks: Track[] = [];

	@Property()
	public createdAt: Date = new Date();
}
