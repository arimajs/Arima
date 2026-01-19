import type { IncomingEventTrackEndPayload } from '@skyra/audio';
import { GameEndReason, LavalinkEvent } from '#types/Enums';
import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';

@ApplyOptions<Listener.Options>({ event: LavalinkEvent.TrackEnd })
export class TrackEndListener extends Listener {
	public async run(payload: IncomingEventTrackEndPayload) {
		const game = this.container.games.get(payload.guildId);
		if (!game) {
			return;
		}

		await game.guessQueue.wait();

		try {
			await game.onTrackEnd();

			for (const player of game.players.values()) {
				// If the player is still in the voice channel (this property is turned to undefined when they leave).
				if (player.lastGameEntryTime) {
					player.songsListenedTo++;
				}
			}

			const points = game.leaderboard.leader?.[1];
			if (points && points === game.goal) {
				await game.end(GameEndReason.GoalMet);
			} else if (game.queue.tracksPlayed === game.limit) {
				await game.end(GameEndReason.LimitReached);
			} else {
				await game.queue.next();
			}
		} finally {
			game.guessQueue.shift();
		}
	}
}
