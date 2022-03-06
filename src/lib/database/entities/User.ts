import type { HexColorString, Snowflake } from 'discord.js';
import { SerializedPrimaryKey, PrimaryKey, Entity, Property, OptionalProps, Embedded, Embeddable } from '@mikro-orm/core';

@Embeddable()
export class Track {
	@Property()
	public track!: string;

	@Property()
	public thumbnail?: string;

	@Property()
	public color?: HexColorString;
}

@Embeddable()
export class Playlist {
	@Property()
	public name!: string;

	@Embedded(() => Track, { array: true })
	public tracks: Track[] = [];

	@Property()
	public createdAt: Date = new Date();
}

@Entity()
export class User {
	public [OptionalProps]?: 'playlists';

	@PrimaryKey({ type: 'string' })
	public _id!: Snowflake;

	@SerializedPrimaryKey({ type: 'string' })
	public id!: Snowflake;

	@Embedded(() => Playlist, { array: true })
	public playlists: Playlist[] = [];
}
