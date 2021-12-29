import type { EntityRepository, MongoDriver } from '@mikro-orm/mongodb';
import type { EntityManager } from '@mikro-orm/core';
import { AsyncLocalStorage } from 'node:async_hooks';
import { MikroORM } from '@mikro-orm/core';
import { User } from '#database/entities/User';
import { env } from '#root/config';

export class DatabaseManager {
	public readonly users: EntityRepository<User>;

	private constructor(public readonly em: EntityManager, public readonly storage: AsyncLocalStorage<EntityManager>) {
		this.users = em.getRepository(User);
	}

	public static async connect() {
		const storage = new AsyncLocalStorage<EntityManager>();

		const orm = await MikroORM.init<MongoDriver>({
			context: () => storage.getStore(),
			clientUrl: env.MONGODB_URI,
			type: 'mongo',

			// File discovery does not support ESM, so all entities must be imported manually.
			entities: [User]
		});

		return new DatabaseManager(orm.em, storage);
	}
}
