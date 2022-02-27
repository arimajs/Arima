import { Constants } from 'discord.js';

/**
 * Rank is calculated by the amount of games a member has won.
 */
export enum Rank {
	Beginner = 0,
	Experienced = 10,
	Master = 20,
	Divine = 30,
	Legendary = 40
}

/**
 * Enum to identify what type of game is being played. Currently there's only one...
 */
export enum GameType {
	Standard = 'standard',
	Binb = 'binb'
}

/**
 * This setting will be configured per-game by the user, and defaults to `AcceptedAnswer.Either`.
 */
export enum AcceptedAnswer {
	Song = 'song',
	Artist = 'artist',
	Either = 'either',
	Both = 'both'
}

/**
 * Identifiers to give context to why a game has ended. Descriptions of each are located where they are used.
 */
export enum GameEndReason {
	HostLeft,
	PlaylistEnded,
	GoalMet,
	LimitReached,
	TextChannelDeleted,
	GuildInaccessible,
	Other
}

/**
 * Event types from the Lavalink `event` event we listen to (mouthful).
 */
export enum LavalinkEvent {
	TrackEnd = 'TrackEndEvent',
	TrackStuck = 'TrackStuckEvent',
	TrackException = 'TrackExceptionEvent'
}

/**
 * The type of a playlist; useful as a typeguard for typescript.
 */
export enum PlaylistType {
	Spotify,
	Lavalink
}

/**
 * Identifiers to give context to why a playlist could not be resolved from user input.
 */
export enum PlaylistResolutionError {
	NotFound,
	NotSuccessful,
	NotPlaylist,
	NotEnoughTracks
}

/**
 * Colors to be used for embeds.
 */
export enum EmbedColor {
	/**
	 * Used for direct responses.
	 */
	Primary = Constants.Colors.AQUA,

	/**
	 * Used for responses that will be edited or followed up (or whenever it seems appropriate).
	 */
	Secondary = Constants.Colors.BLUE,

	/**
	 * Used when reporting errors.
	 */
	Error = Constants.Colors.RED
}
