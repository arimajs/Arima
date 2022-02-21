import type { Message } from 'discord.js';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import { Events, Listener } from '@sapphire/framework';

// The `nonPrefixedMessage` listener is used instead of the base `messageCreate` because, as it was made for message
// commands, all permission and other related checks that would have to be done anyways would already be done.
export class UserListener extends Listener<typeof Events.NonPrefixedMessage> {
	public async run(message: Message) {
		// We don't specify the `DirectMessages` intent, so it isn't currently possible for the message to be from a DM,
		// but typescript needs reassurance.
		if (!message.guild) {
			return;
		}

		const game = this.container.games.get(message.guild.id);
		if (game?.textChannel.id !== message.channel.id) {
			return;
		}

		// One permission check that isn't done by the base listener:
		if (!game.textChannel.permissionsFor(message.guild.me!).has(PermissionFlagsBits.EmbedLinks)) {
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
