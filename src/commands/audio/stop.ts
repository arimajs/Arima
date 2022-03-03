import { CommandOptionsRunTypeEnum } from '@sapphire/framework';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import { GameEndReason } from '#types/Enums';
import { ArimaCommand } from '#structures/ArimaCommand';
import { ApplyOptions } from '@sapphire/decorators';
import { fetchGame } from '#utils/common';

@ApplyOptions<ArimaCommand.Options>({
	description: 'Stop an ongoing game!',
	runIn: [CommandOptionsRunTypeEnum.GuildText, CommandOptionsRunTypeEnum.Dm],
	preconditions: [{ name: 'PlayingGame', context: { shouldBePlaying: true } }],
	requiredClientPermissions: PermissionFlagsBits.EmbedLinks,
	chatInputCommand: {
		register: true,
		idHints: ['937411030118694923']
	}
})
export class UserCommand extends ArimaCommand {
	public override async chatInputRun(interaction: ArimaCommand.Interaction<'cached'>) {
		const game = fetchGame(interaction)!;
		await game.end(GameEndReason.Other, interaction.reply.bind(interaction));
	}
}
