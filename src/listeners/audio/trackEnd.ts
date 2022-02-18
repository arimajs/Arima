import type { IncomingEventTrackEndPayload } from '@skyra/audio';
import { GameEndReason } from '#game/Game';
import { LavalinkEvent } from '#utils/audio';
import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';

@ApplyOptions<Listener.Options>({ event: LavalinkEvent.TrackEnd })
export class UserListener extends Listener {
	public async run(payload: IncomingEventTrackEndPayload) {
		const game = this.container.games.get(payload.guildId);

		if (!game) {
			return;
		}

		await game.guessQueue.wait();

		try {
			await game.onTrackEnd();

			for (const player of game.players.values()) {
				// If the player is still in the voice channel (this property is
				// turned to undefined when they leave).
				if (player.lastGameEntryTime) {
					player.songsListenedTo++;
				}
			}

			const points = game.leaderboard.leader?.[1];
			if (points && game.goal && points === game.goal) {
				await game.end(GameEndReason.GoalMet);
			}

			await game.queue.next();
		} finally {
			game.guessQueue.shift();
		}
	}
}
