import type { Client as StatcordClient } from 'statcord.js';
import type { Collection, Snowflake } from 'discord.js';
import type { DatabaseManager } from '#database/DatabaseManager';
import type { SapphireClient } from '@sapphire/framework';
import type { Node } from '@skyra/audio';
import type { Game } from '#game/Game';

declare module '@sapphire/pieces' {
	interface Container {
		stats?: StatcordClient;
		audio: Node;
		db: DatabaseManager;
		games: Collection<Snowflake, Game>;
	}

	interface Piece {
		client: SapphireClient;
	}
}

declare module '@sapphire/framework' {
	interface Preconditions {
		OwnerOnly: never;
		PlayingGame: { shouldBePlaying: false } | { shouldBePlaying: true; shouldBeHost?: boolean };
	}
}
