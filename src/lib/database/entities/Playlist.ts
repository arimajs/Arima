import type { Snowflake } from 'discord.js';
import { SerializedPrimaryKey, PrimaryKey, Entity, Property, OptionalProps, ManyToMany, Collection } from '@mikro-orm/core';
import { ObjectId } from '@mikro-orm/mongodb';
import { Track } from '#entities/Track';

@Entity()
export class Playlist {
	public [OptionalProps]?: 'tracks' | 'listenCount' | 'createdAt';

	@PrimaryKey()
	public _id!: ObjectId;

	@SerializedPrimaryKey()
	public id!: string;

	@Property({ type: 'string' })
	public creator!: Snowflake;

	@Property()
	public name!: string;

	@ManyToMany(() => Track)
	public tracks = new Collection<Track>(this);

	@Property()
	public listenCount: number = 0;

	@Property()
	public createdAt: Date = new Date();
}
