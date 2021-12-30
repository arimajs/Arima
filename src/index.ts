import '@sapphire/plugin-logger/register';
import 'dotenv/config';

import { SapphireClient, ApplicationCommandRegistries, RegisterBehavior, container } from '@sapphire/framework';
import { GatewayIntentBits } from 'discord-api-types/v9';
import { DatabaseManager } from '#database/DatabaseManager';
import { Constants } from 'discord.js';
import { env } from '#root/config';
import process from 'node:process';

const client = new SapphireClient({
	// Trace loggings clutter the console, and should only be used when debugging @sapphire/pieces specifically.
	enableLoaderTraceLoggings: false,

	// Intents dictate what events the client will receive.
	intents: GatewayIntentBits.Guilds,

	// `Constants.PartialTypes.CHANNEL` partial is required to receive direct messages.
	partials: [Constants.PartialTypes.CHANNEL]
});

ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(RegisterBehavior.Overwrite);

try {
	container.db = await DatabaseManager.connect();
	await client.login(env.TOKEN);
} catch (error) {
	client.logger.fatal(error);
	client.destroy();
	process.exit(1);
}
