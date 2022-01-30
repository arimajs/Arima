/* eslint-disable @typescript-eslint/member-ordering */
import type { CommandInteraction } from 'discord.js';
import { CommandOptionsRunTypeEnum, type ApplicationCommandRegistry } from '@sapphire/framework';
import { createEmbed, sendError } from '#utils/responses';
import { ArimaCommand } from '#structures/ArimaCommand';
import { ApplyOptions } from '@sapphire/decorators';
import { UseForkedEm } from '#utils/decorators';
import { inlineCode, underscore } from '@discordjs/builders';
import { toPercent } from '#utils/common';
import { Rank } from '#entities/Member';

@ApplyOptions<ArimaCommand.Options>({
	description: 'View the stats of a player in this guild!',
	runIn: [CommandOptionsRunTypeEnum.GuildText]
})
export class UserCommand extends ArimaCommand {
	@UseForkedEm
	public override async chatInputRun(interaction: CommandInteraction<'cached'>) {
		const user = interaction.options.getUser('player') ?? interaction.user;
		const player = await this.container.db.members.findOne({ _id: user.id, guildId: interaction.guild.id });

		if (!player) {
			return sendError(interaction, `${user} has not played any games in this guild yet`);
		}

		const gamesInfoPercent = toPercent(player.gamesWon / player.gamesPlayed);
		const gamesInfoDisplay = `${player.gamesWon}/${player.gamesPlayed} (${gamesInfoPercent})`;

		const fields = [
			['Games Won', gamesInfoDisplay],
			['Level', `${player.points} (level ${player.level})`],
			['Rank', Rank[player.rank]]
		];

		const description = fields //
			.map(([title, value]) => `${underscore(`${title}:`)} ${inlineCode(value)}`)
			.join('\n');

		const embed = createEmbed(description).setTitle(`${user.tag} Player Stats`);
		return interaction.reply({ embeds: [embed] });
	}

	public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName(this.name)
					.setDescription(this.description)
					.addUserOption((builder) =>
						builder //
							.setName('player')
							.setDescription('The player to view info of (defaults to the command executor)')
							.setRequired(false)
					),
			{ idHints: ['937411028063514735'] }
		);
	}
}