import type { EntityRepository, MongoDriver } from '@mikro-orm/mongodb';
import { MikroORM, type EntityManager } from '@mikro-orm/core';
import { Member } from '#database/entities/Member';
import { env } from '#root/config';

export class DatabaseManager {
	public readonly members: EntityRepository<Member>;

	private constructor(public readonly em: EntityManager) {
		this.members = em.getRepository(Member);
	}

	public static async connect() {
		const orm = await MikroORM.init<MongoDriver>({
			clientUrl: env.MONGODB_URI,
			type: 'mongo',

			// File discovery does not support ESM, so all entities must be imported manually.
			entities: [Member]
		});

		return new DatabaseManager(orm.em);
	}
}
