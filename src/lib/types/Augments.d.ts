import type { DatabaseManager } from '#database/DatabaseManager';
import type { Collection, Snowflake } from 'discord.js';
import type { Node } from '@skyra/audio';
import type { Game } from '#game/Game';

declare module '@sapphire/pieces' {
	interface Container {
		audio: Node;
		db: DatabaseManager;
		games: Collection<Snowflake, Game>;
	}
}

declare module '@sapphire/framework' {
	interface Preconditions {
		OwnerOnly: never;
	}
}
