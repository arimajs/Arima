/* eslint-disable @typescript-eslint/member-ordering */
import type { Snowflake } from 'discord.js';
import { LoadType, type Track, type IncomingEventTrackExceptionPayload } from '@skyra/audio';
import { getRandomThirtySecondWindow, LavalinkEvent, type Playlist } from '#utils/audio';
import { GameEndReason, type Game } from '#game/Game';
import { container } from '@sapphire/framework';
import { RoundData } from '#game/RoundData';
import { shuffle } from '#utils/common';
import { Time } from '@sapphire/time-utilities';
import NodeCache from 'node-cache';

export class Queue {
	/**
	 * A cache between spotify track titles and the encoded track string found from
	 * Youtube. Usage of node-cache might be refactored to redis if there becomes a
	 * need.
	 */
	private static spotifySongCache = new NodeCache({ stdTTL: Time.Day * Time.Second });

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
	public nowPlaying?: Track;

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
			if (typeof nextTrack !== 'string') {
				// This is what will be searched on Youtube to try to get the
				// most accurate results.
				const displayName = `${nextTrack.name} - ${nextTrack.artist}`;
				const cachedTrack = Queue.spotifySongCache.get<string>(displayName);

				if (cachedTrack) {
					nextTrack = cachedTrack;
				} else {
					const response = await this.player.node.load(`ytsearch: ${displayName}`);
					if (response.loadType === LoadType.SearchResult) {
						[nextTrackFull] = response.tracks;

						// Keep the original artist and track name.
						nextTrackFull.info.author = nextTrack.artist;
						nextTrackFull.info.title = nextTrack.name;

						Queue.spotifySongCache.set(displayName, nextTrackFull.track);
					} else {
						// No matches, or the search failed.
						container.client.emit(LavalinkEvent.TrackException, { guildId: this.game.guild.id } as IncomingEventTrackExceptionPayload);
					}
				}
			}

			this.nowPlaying = nextTrackFull ?? { track: nextTrack as string, info: await this.player.node.decode(nextTrack as string) };
			this.game.round = new RoundData(this.nowPlaying.info.title, [this.nowPlaying.info.author]);
			await this.player.play(this.nowPlaying, getRandomThirtySecondWindow(this.nowPlaying.info.length));
		} else {
			await this.game.end(GameEndReason.PlaylistEnded);
		}
	}

	public async end() {
		this.nowPlaying = undefined;

		// Stops the player and leaves the voice channel.
		await Promise.all([this.player.leave(), this.player.stop()]);
	}

	public static getPlayer(guildId: Snowflake) {
		return container.audio.players.get(guildId);
	}
}
