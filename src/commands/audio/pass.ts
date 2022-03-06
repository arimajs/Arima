import { inlineCode, italic, userMention } from '@discordjs/builders';
import { CommandOptionsRunTypeEnum } from '@sapphire/framework';
import { createEmbed, sendError } from '#utils/responses';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import { ArimaCommand } from '#structures/ArimaCommand';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<ArimaCommand.Options>({
	description: 'Give up on the current song! If everyone passes, the song will skip.',
	runIn: [CommandOptionsRunTypeEnum.GuildText],
	preconditions: [{ name: 'PlayingGame', context: { shouldBePlaying: true } }],
	requiredClientPermissions: PermissionFlagsBits.EmbedLinks,
	chatInputCommand: {
		idHints: ['945127477829861416'],
		register: true
	}
})
export class PassCommand extends ArimaCommand {
	public override async chatInputRun(interaction: ArimaCommand.Interaction<'cached'>) {
		const game = this.container.games.get(interaction.guild.id)!;
		if (game.round.passedPlayers.has(interaction.user.id)) {
			return sendError(interaction, 'You have already passed this round');
		}

		const { passedPlayers } = game.round;
		passedPlayers.add(interaction.user.id);

		let embedDescription = `${userMention(interaction.user.id)} has passed! 🏃‍♂️`;

		const everyonePassed = passedPlayers.size === game.players.size;
		if (!everyonePassed) {
			const remaining = inlineCode(`${passedPlayers.size}/${game.players.size}`);
			embedDescription += `\n${italic(`💡 If everyone passes, the song will skip (${remaining}`)}`;
		}

		const embed = createEmbed(embedDescription);
		await interaction.reply({ embeds: [embed] });

		if (everyonePassed) {
			await game.queue.player.stop();
		}
	}
}
