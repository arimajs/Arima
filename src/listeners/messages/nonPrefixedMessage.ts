import type { Message } from 'discord.js';
import { Events, Listener } from '@sapphire/framework';
import { isDMChannel, isTextChannel } from '@sapphire/discord.js-utilities';

// The `nonPrefixedMessage` listener is used instead of the base `messageCreate` because, as it was made for message
// commands, all permission and other related checks that would have to be done anyways would already be done.
export class UserListener extends Listener<typeof Events.NonPrefixedMessage> {
	public async run(message: Message) {
		if (!isDMChannel(message.channel) && !isTextChannel(message.channel)) {
			return;
		}

		const game = message.guild
			? this.container.games.get(message.guild.id)
			: this.container.games.find((game) => game.players.has(message.author.id));

		if (!game?.validGuessChannel(message.channel)) {
			return;
		}

		// If the player used /pass, they can't guess.
		if (game.round.passedPlayers.has(message.author.id)) {
			return;
		}

		// AsyncQueues are used to prevent race conditions and ensure that guesses are processed in the order they were
		// received.
		await game.guessQueue.wait();

		// The following is encapsulated in a try...finally so that the queue won't get stuck forever if an error
		// occurs.
		try {
			await game.guess(message);
		} finally {
			game.guessQueue.shift();
		}
	}
}
