import type { HexColorString } from 'discord.js';
import { Entity, PrimaryKey, Property, SerializedPrimaryKey } from '@mikro-orm/core';
import { ObjectId } from '@mikro-orm/mongodb';

@Entity()
export class Track {
	@PrimaryKey()
	public _id!: ObjectId;

	@SerializedPrimaryKey()
	public id!: string;

	@Property()
	public urls!: string[];

	@Property()
	public track!: string;

	@Property({ nullable: true })
	public thumbnail?: string;

	@Property({ type: 'string', nullable: true })
	public color?: HexColorString;
}
