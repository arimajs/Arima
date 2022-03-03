import type { Snowflake } from 'discord.js';
import { cleanSongName, cleanArtistName } from '#utils/audio';

export class RoundData {
	public readonly validSongVariations: string[];
	public readonly songGuessers = new Set<Snowflake>();
	public readonly artistGuessers: ReadonlyMap<string, Set<Snowflake>>;
	public readonly primaryArtistGuessers = new Set<Snowflake>();
	public readonly doubleGuessers: Snowflake[] = [];
	public readonly primaryArtist: string;
	public readonly passedPlayers = new Set<Snowflake>();
	public readonly startTime = Date.now();

	public constructor(song: string, artists: string[]) {
		const cleanedArtistNames = artists.map((artist) => cleanArtistName(artist));
		this.validSongVariations = cleanSongName(song, cleanedArtistNames);

		this.artistGuessers = new Map(cleanedArtistNames.map((artist) => [artist, new Set<Snowflake>()]));

		// The first key and value have their own respective properties for utility purposes.
		[[this.primaryArtist, this.primaryArtistGuessers]] = this.artistGuessers;
	}
}
