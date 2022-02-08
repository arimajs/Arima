import { MikroORM } from '@mikro-orm/core';
import { Member } from '#entities/Member';

export class DatabaseManager extends MikroORM {
	public readonly members = this.em.getRepository(Member);
}
