import '@sapphire/plugin-logger/register';
import 'dotenv/config';

import { SapphireClient, ApplicationCommandRegistries, RegisterBehavior } from '@sapphire/framework';
import { GatewayIntentBits } from 'discord-api-types/v9';
import { yellow, green, bold } from 'colorette';
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
	client.logger.info(yellow('Logging in'));
	await client.login(env.TOKEN);
	client.logger.info(bold(green('Logged in')));
} catch (error) {
	client.logger.fatal(error);
	client.destroy();
	process.exit(1);
}

// This should be placed in /lib/types/Augments.d.ts once there's a need to
// import an external type, as declaring modules in ambient contexts (without
// top-level imports) will result in an overwrite instead augmentation.
declare module '@sapphire/framework' {
	interface Preconditions {
		OwnerOnly: never;
	}
}
