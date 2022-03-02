import { StandardGame } from '#game/StandardGame';
import { BinbGame } from '#game/BinbGame';

/**
 * Enum to identify what type of game is being played.
 */
export enum Gametype {
	Standard = 'standard',
	Binb = 'binb'
}

/**
 * Map from Gametypes to Game subclasses
 */
export const Games = {
	[Gametype.Standard]: StandardGame,
	[Gametype.Binb]: BinbGame
};
