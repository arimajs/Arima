import { Command, ApplicationCommandRegistry, type Args, type Piece } from '@sapphire/framework';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import { Permissions, type CacheType } from 'discord.js';
import { env } from '#root/config';

export abstract class ArimaCommand<O extends ArimaCommand.Options = ArimaCommand.Options> extends Command<Args, O> {
	public constructor(context: Piece.Context, options: O) {
		super(context, {
			// All commands use embeds and thus require this permissions
			requiredClientPermissions: new Permissions(options.requiredClientPermissions).add(PermissionFlagsBits.EmbedLinks),
			generateDashLessAliases: true,
			...options
		});

		// If this command is owner only:
		if (this.category === 'dev') {
			// Enable it only if there is a development server on the assumption it would've been registered guild wide
			// otherwise.
			this.enabled &&= Boolean(env.DEV_SERVER_ID);

			// Automatically enable the OwnerOnly precondition.
			this.preconditions.append('OwnerOnly');
		}
	}
}

export namespace ArimaCommand {
	// Convenience type to save imports.
	export type Options = Command.Options;
	export type Interaction<Cache extends CacheType = CacheType> = Command.ChatInputInteraction<Cache>;
	export type Registry = ApplicationCommandRegistry;
}

// This is a hacky (but perfectly safe) way to have quickly updating slash commands for development. This is achieved by
// overriding the registerChatInputCommand method and making commands guild-scoped to the dev server if NODE_ENV is
// 'development' (which will make updates show up immediately).

const target = 'registerChatInputCommand' as const;
type Target = ApplicationCommandRegistry[typeof target];

// eslint-disable-next-line @typescript-eslint/unbound-method
const { registerChatInputCommand } = ApplicationCommandRegistry.prototype;
Object.defineProperty(ApplicationCommandRegistry.prototype, target, {
	value(...[command, options]: Parameters<Target>) {
		return registerChatInputCommand.call(this, command, { guildIds: env.isDev ? [env.DEV_SERVER_ID] : undefined, ...options });
	}
});
