import type { Snowflake } from 'discord.js';
import { LoadType, type Track, type TrackInfo, type IncomingEventTrackExceptionPayload } from '@skyra/audio';
import { getRandomThirtySecondWindow, LavalinkEvent, type Playlist } from '#utils/audio';
import { GameEndReason, type Game } from '#game/Game';
import { container } from '@sapphire/framework';
import { shuffle } from '#utils/common';
import { Time } from '@sapphire/time-utilities';
import NodeCache from 'node-cache';

/**
 * A cache between spotify track titles and the encoded track string found from
 * Youtube. Usage of node-cache might be refactored to redis if there becomes a
 * need.
 */
const spotifySongCache = new NodeCache({ stdTTL: Time.Day * Time.Second });

export class Queue {
	/**
	 * A constant number that represents the original length of the playlist.
	 * This is useful when determining how many tracks have been played so far.
	 * It will be decremented if a Spotify song can not be found on Youtube.
	 */
	public playlistLength: number;

	/**
	 * The track that is currently playing. This is undefined if there is no
	 * track playing, obviously, and is reassigned each time a new track starts.
	 */
	public currentlyPlaying?: TrackInfo;

	// `tracks` should be an array of strings, each representing a track encoded
	// by Lavalink.
	public constructor(public readonly game: Game, public playlist: Playlist) {
		// Shuffle the playlist tracks in place.
		shuffle(playlist.tracks);
		this.playlistLength = playlist.tracks.length;
	}

	public get tracksPlayed() {
		return this.playlistLength - this.playlist.tracks.length;
	}

	public get player() {
		return Queue.getPlayer(this.game.guild.id);
	}

	public async next() {
		// This will be an info object if playing a Spotify playlist, and a
		// string otherwise.
		let nextTrack = this.playlist.tracks.pop();

		// Will be the result of `node.load` if we have to search for a Spotify
		// song. It already gives the track info, so it's better to store it
		// instead of waste another API call to retrieve what we already have
		// later in the code.
		let nextTrackFull: Track | undefined;

		if (nextTrack) {
			// Reset round-specific properties.
			this.game.guessedThisRound = undefined;
			this.game.guessersThisRound = [];

			if (typeof nextTrack !== 'string') {
				// This is what will be searched on Youtube to try to get the
				// most accurate results.
				const displayName = `${nextTrack.name} - ${nextTrack.artist}`;
				const cachedTrack = spotifySongCache.get<string>(displayName);

				if (cachedTrack) {
					nextTrack = cachedTrack;
				} else {
					const response = await this.player.node.load(`ytsearch: ${displayName}`);
					if (response.loadType === LoadType.SearchResult) {
						[nextTrackFull] = response.tracks;
						spotifySongCache.set(displayName, nextTrackFull.track);
					} else {
						// No matches, or the search failed.
						container.client.emit(LavalinkEvent.TrackException, { guildId: this.game.guild.id } as IncomingEventTrackExceptionPayload);
					}
				}
			}

			this.currentlyPlaying = nextTrackFull?.info ?? (await this.player.node.decode(nextTrack as string));

			await this.player.play(
				nextTrackFull ?? { track: nextTrack as string, info: this.currentlyPlaying },
				getRandomThirtySecondWindow(this.currentlyPlaying.length)
			);
		} else {
			await this.game.end(GameEndReason.PlaylistEnded);
		}
	}

	public async end() {
		this.currentlyPlaying = undefined;

		// Stops the player and leaves the voice channel.
		await this.player.destroy();
	}

	public static getPlayer(guildId: Snowflake) {
		return container.audio.players.get(guildId);
	}
}
