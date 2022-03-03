import type { Snowflake } from 'discord.js';
import { cleanSongName, cleanArtistName } from '#utils/audio';

export class RoundData {
	public readonly songGuessers: Snowflake[] = [];
	public readonly validSongVariations: string[];
	public readonly artistGuessers: ReadonlyMap<string, Snowflake[]>;
	public readonly primaryArtistGuessers: Snowflake[];
	public readonly primaryArtist: string;
	public readonly passedPlayers = new Set<Snowflake>();

	public constructor(song: string, artists: string[]) {
		const cleanedArtistNames = artists.map((artist) => cleanArtistName(artist));
		this.validSongVariations = cleanSongName(song, cleanedArtistNames);

		this.artistGuessers = new Map(cleanedArtistNames.map((artist) => [artist, []]));

		// The first key and value have their own respective properties for utility purposes.
		[[this.primaryArtist, this.primaryArtistGuessers]] = this.artistGuessers;
	}
}
