import type { TrackInfo } from '@skyra/audio';
import type { Snowflake } from 'discord.js';
import type { Game } from '#game/Game';
import { getRandomThirtySecondWindow } from '#utils/audio';
import { GameEndReason } from '#game/Game';
import { container } from '@sapphire/framework';

export class Queue {
	/**
	 * A constant number that represents the original length of the playlist.
	 * This is useful when determining how many tracks have been played so far.
	 */
	public readonly playlistLength: number;

	/**
	 * The track that is currently playing. This is undefined if there is no
	 * track playing, obviously, and is reassigned each time a new track starts.
	 */
	public currentlyPlaying?: TrackInfo;

	// `tracks` should be an array of strings, each representing a track encoded
	// by Lavalink.
	public constructor(public readonly game: Game, public tracks: string[]) {
		this.playlistLength = tracks.length;
	}

	public get tracksPlayed() {
		return this.playlistLength - this.tracks.length;
	}

	public get player() {
		return Queue.getPlayer(this.game.guild.id);
	}

	public async next() {
		const nextTrack = this.tracks.pop();

		if (nextTrack) {
			// Reset round-specific properties.
			this.game.guessedThisRound = undefined;
			this.game.guesserThisRound = undefined;

			this.currentlyPlaying = await this.player.node.decode(nextTrack);
			await this.player.play(nextTrack, getRandomThirtySecondWindow(this.currentlyPlaying.length));
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
