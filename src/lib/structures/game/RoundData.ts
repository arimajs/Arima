import type { Snowflake } from 'discord.js';
import { cleanSongName, cleanArtistName } from '#utils/audio';
import { Collection } from 'discord.js';

export class RoundData {
	public readonly validSongVariations: string[] = [];
	public readonly songGuessers: Snowflake[] = [];
	public readonly artistGuessers = new Collection<string, Snowflake[]>();
	public readonly primaryArtist = String();

	public constructor(song: string, artists: string[]) {
		this.validSongVariations = cleanSongName(song);
		this.artistGuessers = new Collection(artists.map((artist) => [cleanArtistName(artist), []]));
		this.primaryArtist = this.artistGuessers.firstKey()!;
	}

	public get primaryArtistGuessers() {
		return this.artistGuessers.first()!;
	}
}
