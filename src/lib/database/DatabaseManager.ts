import type { EntityManager, EntityRepository, MongoDriver } from '@mikro-orm/mongodb';
import { dbOptions } from '#root/config';
import { MikroORM } from '@mikro-orm/core';
import { Member } from '#entities/Member';

export class DatabaseManager {
	public readonly em: EntityManager;
	public readonly members: EntityRepository<Member>;

	private constructor(public readonly orm: MikroORM<MongoDriver>) {
		this.em = orm.em;
		this.members = orm.em.getRepository(Member);
	}

	public static async connect() {
		const orm = await MikroORM.init<MongoDriver>(dbOptions);
		return new DatabaseManager(orm);
	}
}
