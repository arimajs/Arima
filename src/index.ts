import '@sapphire/plugin-logger/register';
import 'dotenv/config';

import { SapphireClient, ApplicationCommandRegistries, RegisterBehavior, Piece, container } from '@sapphire/framework';
import { clientOptions, env } from '#root/config';
import { DatabaseManager } from '#database/DatabaseManager';
import process from 'node:process';
import { PaginatedMessage } from '@sapphire/discord.js-utilities';

const client = new SapphireClient(clientOptions);

ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(RegisterBehavior.Overwrite);

// This reply is overridden for a much less passive aggressive tone.
PaginatedMessage.wrongUserInteractionReply = (user) => `❌ Only ${user} can use these buttons!`;

// Utility - saves a lot of characters. A lot.
Object.defineProperty(Piece.prototype, 'client', { get: () => container.client });

try {
	container.db = await DatabaseManager.connect();
	await client.login(env.TOKEN);
} catch (error) {
	client.logger.fatal(error);
	client.destroy();
	process.exit(1);
}
