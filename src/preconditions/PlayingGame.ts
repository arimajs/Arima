import type { CommandInteraction } from 'discord.js';
import { Precondition } from '@sapphire/framework';

// Asserts a game is or is not being played in a guild. If a game should be playing, will also assert that the
// interaction author is playing the game. Should always be used with `runIn` set to a `GUILD_*` value.
export class UserPrecondition extends Precondition {
	// Context, `shouldBePlaying`, can be set to false if you want to assert the guild is *not* playing a game.
	public override async chatInputRun(
		interaction: CommandInteraction,
		_command: never,
		{ shouldBePlaying = true, shouldBeHost = false }: Precondition.Context
	) {
		const game = this.container.games.get(interaction.guildId!);

		if (game && !shouldBePlaying) {
			return this.error({ message: "There's already a game being played" });
		}

		if (shouldBePlaying && !game?.players.has(interaction.user.id)) {
			return this.error({ message: "You aren't playing a game" });
		}

		if (shouldBePlaying && game!.textChannel.id !== interaction.channelId) {
			return this.error({ message: 'Please only use game-related commands in the channel where the game is being played' });
		}

		if (shouldBePlaying && shouldBeHost && game!.host.id !== interaction.user.id) {
			return this.error({ message: 'Only the game host can use this command' });
		}

		return this.ok();
	}
}
