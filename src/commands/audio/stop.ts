/* eslint-disable @typescript-eslint/member-ordering */
import type { CommandInteraction } from 'discord.js';
import { CommandOptionsRunTypeEnum } from '@sapphire/framework';
import { GameEndReason } from '#game/Game';
import { ArimaCommand } from '#structures/ArimaCommand';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<ArimaCommand.Options>({
	description: 'Stop an ongoing game!',
	runIn: [CommandOptionsRunTypeEnum.GuildText],
	preconditions: [{ name: 'PlayingGame', context: { shouldBePlaying: true } }],
	chatInputCommand: {
		register: true,
		idHints: ['932795359787356160']
	}
})
export class UserCommand extends ArimaCommand {
	public override async chatInputRun(interaction: CommandInteraction<'cached'>) {
		const game = this.container.games.get(interaction.guild.id)!;
		await game.end(GameEndReason.Other, interaction.reply.bind(interaction));
	}
}
