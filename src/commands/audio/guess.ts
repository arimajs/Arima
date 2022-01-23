/* eslint-disable @typescript-eslint/member-ordering */
import type { CommandInteraction } from 'discord.js';
import { CommandOptionsRunTypeEnum, type ApplicationCommandRegistry } from '@sapphire/framework';
import { sendError, createEmbed } from '#utils/responses';
import { ArimaCommand } from '#structures/ArimaCommand';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<ArimaCommand.Options>({
	description: 'Guess the answer in an ongoing game!',
	runIn: [CommandOptionsRunTypeEnum.GuildText],
	preconditions: [{ name: 'PlayingGame', context: { shouldBePlaying: true } }]
})
export class UserCommand extends ArimaCommand {
	public override async chatInputRun(interaction: CommandInteraction<'cached'>) {
		const game = this.container.games.get(interaction.guild.id)!;
		const guess = interaction.options.getString('guess', true);

		const wasAlreadyHalfGuessed = Boolean(game.guessedThisRound);
		const wasCorrect = game.guess(interaction.user, guess);

		if (!wasCorrect) {
			return sendError(interaction, `Sorry, **"${guess}"** is incorrect`, false);
		}

		const embed = createEmbed(
			`✅ You got it!${
				!wasAlreadyHalfGuessed && game.guessedThisRound
					? ` **"${guess}"** is the ${game.acceptedAnswer.toLowerCase()}'s name. You're halfway there!`
					: ''
			}`
		);

		await interaction.reply({ embeds: [embed] });
		await game.queue.player.stop();
	}

	public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName(this.name)
					.setDescription(this.description)
					.addStringOption((builder) =>
						builder
							.setName('guess')
							.setDescription('Your guess! It will be case insensitive and typos will be forgiven using a fancy algorithm 🤓')
							.setRequired(true)
					),
			{ idHints: ['931014505276792923'] }
		);
	}
}
