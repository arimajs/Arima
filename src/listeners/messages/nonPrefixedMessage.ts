import type { Message } from 'discord.js';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import { Events, Listener } from '@sapphire/framework';
import { createEmbed } from '#utils/responses';

// The `nonPrefixedMessage` listener is used instead of the base `messageCreate`
// because, as it was made for message commands, all permission and other
// related checks that would have to be done anyways would already be done.
export class UserListener extends Listener<typeof Events.NonPrefixedMessage> {
	public async run(message: Message) {
		// We don't specify the `DirectMessages` intent, so it isn't currently
		// possible for the message to be from a DM, but typescript needs
		// reassurance.
		if (!message.guild) {
			return;
		}

		const game = this.container.games.get(message.guild.id);
		if (game?.textChannel.id !== message.channel.id) {
			return;
		}

		// One permission check that isn't done by the base listener:
		// `message.guild.me` is guarranteed to be present by, again, the base listener
		if (!game.textChannel.permissionsFor(message.guild.me!).has(PermissionFlagsBits.EmbedLinks)) {
			return;
		}

		const wasAlreadyHalfGuessed = Boolean(game.guessedThisRound);
		const wasCorrect = game.guess(message.author, message.content);

		if (!wasCorrect) {
			return console.log('nope');
		}

		const isHalfGuessed = !wasAlreadyHalfGuessed && Boolean(game.guessedThisRound);

		let halfGuessedString = '';
		if (isHalfGuessed) {
			halfGuessedString = ` **"${message.content}"** is the ${game.guessedThisRound!.toLowerCase()}'s name. You're halfway there!`;
		}

		const embed = createEmbed(`✅ You got it!${halfGuessedString}`);
		const promises: Promise<unknown>[] = [];

		promises.push(message.channel.send({ embeds: [embed] }));

		if (!isHalfGuessed) {
			promises.push(game.queue.player.stop());
		}

		return Promise.all(promises);
	}
}
