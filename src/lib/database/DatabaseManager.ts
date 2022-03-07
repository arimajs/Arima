import type { EntityManager, EntityRepository, MongoDriver } from '@mikro-orm/mongodb';
import { dbOptions } from '#root/config';
import { MikroORM } from '@mikro-orm/core';
import { Playlist } from '#entities/Playlist';
import { Member } from '#entities/Member';
import { Track } from '#entities/Track';

export class DatabaseManager {
	public readonly em: EntityManager;
	public readonly members: EntityRepository<Member>;
	public readonly playlists: EntityRepository<Playlist>;
	public readonly tracks: EntityRepository<Track>;

	private constructor(public readonly orm: MikroORM<MongoDriver>) {
		this.em = orm.em;
		this.members = orm.em.getRepository(Member);
		this.playlists = orm.em.getRepository(Playlist);
		this.tracks = orm.em.getRepository(Track);
	}

	public static async connect() {
		const orm = await MikroORM.init<MongoDriver>(dbOptions);
		return new DatabaseManager(orm);
	}
}
