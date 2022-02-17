import type { Snowflake } from 'discord.js';
import { cleanSongName, cleanArtistName } from '#utils/audio';
import { Collection } from 'discord.js';

export class RoundData {
	public validSongVariations: string[] = [];
	public guessedSong: Snowflake[] = [];
	public guessedArtists = new Collection<string, Snowflake[]>();
	public primaryArtist = '';

	public constructor(song: string, artists: string[]) {
		this.validSongVariations = cleanSongName(song);
		this.guessedArtists = new Collection(artists.map((artist) => [cleanArtistName(artist), []]));
		this.primaryArtist = this.guessedArtists.firstKey() ?? this.primaryArtist;
	}
}
