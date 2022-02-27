import type { Options as MikroOptions } from '@mikro-orm/core';
import type { MongoDriver } from '@mikro-orm/mongodb';
import type { NodeOptions } from '@skyra/audio';
import { Options, type Client, type ClientOptions, type CacheFactory, type SweeperOptions } from 'discord.js';
import { cleanEnv, str, port } from 'envalid';
import { container, LogLevel } from '@sapphire/framework';
import { GatewayIntentBits } from 'discord-api-types/v9';
import { Time } from '@sapphire/time-utilities';
import process from 'node:process';

// Unless explicitly defined, set NODE_ENV to development.
process.env.NODE_ENV ??= 'development';

export const env = cleanEnv(process.env, {
	DISCORD_TOKEN: str({ desc: 'The discord bot token' }),
	MONGODB_URI: str({ desc: 'The mongo connection string' }),
	LAVALINK_HOST: str({ desc: 'The http and ws host of your Lavalink instance' }),
	LAVALINK_PORT: port({ desc: 'The http and ws port of your Lavalink instance' }),
	LAVALINK_PASSWORD: str({ desc: 'The password of your Lavalink instance' }),
	SUPPORT_SERVER_INVITE: str({ default: '' }),
	DEV_SERVER_ID: str({ default: '' }),
	STATCORD_API_KEY: str({ default: '' })
});

export const createAudioOptions = (client: Client): NodeOptions => ({
	userID: client.user!.id,
	password: env.LAVALINK_PASSWORD,
	host: `${env.LAVALINK_HOST}:${env.LAVALINK_PORT}`
});

// Almost no cache is needed, so we set the limit to 0 for most managers.
const cache: CacheFactory = Options.cacheWithLimits({
	ApplicationCommandManager: 0,
	BaseGuildEmojiManager: 0,
	GuildBanManager: 0,
	GuildEmojiManager: 0,
	GuildInviteManager: 0,
	GuildScheduledEventManager: 0,
	GuildStickerManager: 0,
	MessageManager: 0,
	PresenceManager: 0,
	ReactionManager: 0,
	ReactionUserManager: 0,
	StageInstanceManager: 0,
	ThreadManager: 0,
	ThreadMemberManager: 0,
	// Cache only the bot's member in every guild to calculate permissions.
	GuildMemberManager: {
		maxSize: 1,
		keepOverLimit: (member) => member.id === container.client.user?.id
	}
});

const sweepers: SweeperOptions = {
	...Options.defaultSweeperSettings,
	users: {
		interval: 10 * Time.Minute,
		filter: () => {
			// All "players" have the potential to guess correctly, in which case their full user object is required, so
			// it be more efficient to keep them cached.
			const relevantUsers = new Set([...container.games.values()].flatMap(({ players }) => [...players.keys()]));
			return (user) => !relevantUsers.has(user.id);
		}
	}
};

export const clientOptions: ClientOptions = {
	// Intents dictate what events the client will receive.
	intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildMessages | GatewayIntentBits.GuildVoiceStates | GatewayIntentBits.DirectMessages,
	partials: ['CHANNEL'], // required to receive DMs
	logger: { level: env.isProduction ? LogLevel.Info : LogLevel.Debug },
	loadDefaultErrorListeners: false,
	// "Message Command" listeners include the one used to receive game guesses.
	loadMessageCommandListeners: true,
	makeCache: cache,
	sweepers
};

export const dbOptions: MikroOptions<MongoDriver> = {
	clientUrl: env.MONGODB_URI,
	type: 'mongo',
	entities: ['./dist/lib/database/entities']
};
