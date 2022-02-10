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
		const wasCorrect = game.guess(interaction.user, guess.toLowerCase());

		if (!wasCorrect) {
			return sendError(interaction, `Sorry, **"${guess}"** is incorrect`, false);
		}

		const isHalfGuessed = !wasAlreadyHalfGuessed && Boolean(game.guessedThisRound);

		let halfGuessedString = '';
		if (isHalfGuessed) {
			halfGuessedString = ` **"${guess}"** is the ${game.guessedThisRound!.toLowerCase()}'s name. You're halfway there!`;
		}

		const embed = createEmbed(`✅ You got it!${halfGuessedString}`);
		const promises: Promise<unknown>[] = [];

		promises.push(interaction.reply({ embeds: [embed] }));

		if (!isHalfGuessed) {
			promises.push(game.queue.player.stop());
		}

		return Promise.all(promises);
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
			{ idHints: ['937409134192648192'] }
		);
	}
}
