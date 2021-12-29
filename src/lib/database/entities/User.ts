import type { Snowflake } from 'discord.js';
import { PrimaryKey, Entity } from '@mikro-orm/core';

@Entity()
export class User {
	@PrimaryKey({ type: 'string' })
	public _id!: Snowflake;
}
