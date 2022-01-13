import type { Client, ClientOptions } from 'discord.js';
import type { NodeOptions } from '@skyra/audio';
import { cleanEnv, str, port } from 'envalid';
import { GatewayIntentBits } from 'discord-api-types/v9';
import { LogLevel } from '@sapphire/framework';
import process from 'node:process';

// Unless explicitly defined, set NODE_ENV to development.
process.env.NODE_ENV ??= 'development';

export const env = cleanEnv(process.env, {
	TOKEN: str({ desc: 'The discord bot token' }),
	MONGODB_URI: str({ desc: 'The mongo connection string' }),
	LAVALINK_HOST: str({ desc: 'The http and ws host of your Lavalink instance' }),
	LAVALINK_PORT: port({ desc: 'The http and ws port of your Lavalink instance' }),
	LAVALINK_PASSWORD: str({ desc: 'The password of your Lavalink instance' }),
	SUPPORT_SERVER_INVITE: str({ default: '' })
});

export const createAudioOptions = (client: Client): NodeOptions => ({
	userID: client.user!.id,
	password: env.LAVALINK_PASSWORD,
	host: `${env.LAVALINK_HOST}:${env.LAVALINK_PORT}`
});

export const clientOptions: ClientOptions = {
	// Intents dictate what events the client will receive.
	intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildVoiceStates,
	logger: { level: env.isProduction ? LogLevel.Info : LogLevel.Debug }
};
