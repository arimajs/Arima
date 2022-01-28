import type { VoiceState } from 'discord.js';
import { Listener, type Events } from '@sapphire/framework';
import { GameEndReason } from '#root/lib/structures/game/Game';

// This event is run on voice channel joins, moves, or disconnects of any person
// in a guild channel.
export class UserListener extends Listener<typeof Events.VoiceStateUpdate> {
	public async run(oldState: VoiceState, newState: VoiceState) {
		const game = this.container.games.get(newState.guild.id);

		// If there's no game associated with the guild or the voice channel of
		// the game was were referenced in the update.
		if (!game || ![oldState.channelId, newState.channelId].includes(game.voiceChannel.id)) {
			return;
		}

		const member = oldState.member || newState.member;

		// I don't think this should ever happen, but just in case.
		if (!member) {
			return;
		}

		// If the old channel is nonexistent or not the game voice channel, the
		// user joined or moved to the channel.
		if (oldState.channelId !== game.voiceChannel.id && member.id !== this.client.user!.id) {
			const player = game.players.get(member.id);

			if (player) {
				// If a player exists, it means they previously left and have
				// now rejoined. If so, readjust the `lastGameEntryTime` for an
				// accurate count of how long they've been in the voice channel.
				// This field will be used when the member leaves, or when the
				// game ends and the member is still in the voice channel.
				player.lastGameEntryTime = Date.now();
			} else {
				// Otherwise, create a new player.
				game.players.set(member.id, {
					lastGameEntryTime: Date.now(),
					totalPlayTime: 0,
					songsListenedTo: 0,
					id: member.id
				});
			}

			return;
		}

		// If the new channel is nonexistent, the user left the voice channel.
		// If it's the bot that left, a different course of behavior should be
		// taken.
		if (!newState.channelId && member.id !== this.client.user!.id) {
			if (member.id === game.hostUser.id) {
				// If the user who left was the host, end the game, as the host
				// is the only one who can use the leave command. This behavior
				// might be changed in the future.
				return game.end(GameEndReason.HostLeft);
			}

			const player = game.players.get(member.id);
			if (player) {
				// Update their total play time. Their lastGameEntryTime would
				// have been populated on their last join or when the game
				// started.
				player.totalPlayTime += Date.now() - player.lastGameEntryTime!;

				// Making the entry time undefined will mark that the player is
				// no longer in the voice channel.
				player.lastGameEntryTime = undefined;
			}

			return;
		}

		// If the bot is playing to nobody... stop.
		const isAlone = !game.voiceChannel.members.some((member) => !member.user.bot);
		const wasDisconnected = !newState.channelId;

		if (isAlone || wasDisconnected) {
			await game.end(GameEndReason.Other);
		}
	}
}
