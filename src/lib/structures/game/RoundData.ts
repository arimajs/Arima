import type { User } from 'discord.js';

export class RoundData {
	public validTrackNames: string[] = [];
	public playersGuessedTrackName: Set<User> = new Set();
	// keys are the valid artists, values are lists of players who have guessed the artist
	// not the most elegant data structure, I know
	public trackArtistsGuessed: Record<string, Set<User>> = {};
	public primaryArtist = '';

	public reset(trackName: string, trackArtists: string[]) {
		this.validTrackNames = this.cleanTrackName(trackName);
		this.playersGuessedTrackName.clear();
		this.trackArtistsGuessed = {};
		for (const artist of trackArtists) {
			this.trackArtistsGuessed[this.cleanArtistName(artist)] = new Set();
		}
		// should probably use a better data structure for the artists and list of users who have guessed them :poop:
		// next line also assumes the 'first' artist is the main one
		// eslint-disable-next-line prefer-destructuring
		this.primaryArtist = Object.keys(this.trackArtistsGuessed)[0];
	}

	// these don't need to be class methods
	private cleanTrackName(trackName: string): string[] {
		// "Blank Space - Taylor Swift" -> "Blank Space"
		// "Blank Space (Lyric Video)" -> "Blank Space"
		const songWithoutSuffix = trackName.replace(/\s*\(.*|\s*- .*/, '');

		// "Taylor Swift  -  Blank Space" -> "Blank Space"
		const songWithoutPrefix = trackName.replace(/.* -\s*/, '');

		// Applies both of the above, one at a time.
		// "Taylor Swift - Blank Space (Lyrics Video)" -> "Blank Space"
		let songWithoutSuffixAndPrefix = trackName;
		songWithoutSuffixAndPrefix = songWithoutSuffixAndPrefix.replace(/.* -\s*/, '');
		songWithoutSuffixAndPrefix = songWithoutSuffixAndPrefix.replace(/\s*\(.*|\s*- .*/, '');

		// Try a bunch of different variations to try to match the most accurate track name.
		const validSongVariations = [
			...[songWithoutSuffixAndPrefix, songWithoutPrefix, songWithoutSuffix].filter((str) => str !== trackName),
			trackName
		];

		return validSongVariations;
	}

	private cleanArtistName(artistName: string) {
		return artistName;
	}
}
