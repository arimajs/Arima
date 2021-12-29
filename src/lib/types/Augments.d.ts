import type { DatabaseManager } from '../database/DatabaseManager';

declare module '@sapphire/pieces' {
	interface Container {
		db: DatabaseManager;
	}
}

declare module '@sapphire/framework' {
	interface Preconditions {
		OwnerOnly: never;
	}
}
