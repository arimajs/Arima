import type { Snowflake } from 'discord.js';
import { cleanSongName, cleanArtistName } from '#utils/audio';

export class RoundData {
	public readonly validSongVariations: string[];
	public readonly songGuessers: Snowflake[] = [];
	public readonly artistGuessers: ReadonlyMap<string, Snowflake[]>;
	public readonly primaryArtistGuessers: Snowflake[];
	public readonly primaryArtist: string;
	public readonly passedPlayers = new Set<Snowflake>();
	public readonly startTime = Date.now();

	public constructor(song: string, artists: string[]) {
		this.validSongVariations = cleanSongName(song);

		const cleanedArtistNames = artists.map<[string, Snowflake[]]>((artist) => [cleanArtistName(artist), []]);
		this.artistGuessers = new Map(cleanedArtistNames);

		// The first key and value have their own respective properties for utility purposes.
		[[this.primaryArtist, this.primaryArtistGuessers]] = cleanedArtistNames;
	}
}
