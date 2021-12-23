import type { PieceContext } from '@sapphire/framework';
import { Command as SapphireCommand, UserError } from '@sapphire/framework';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import { Permissions } from 'discord.js';

export abstract class Command extends SapphireCommand {
	public constructor(context: PieceContext, options: SapphireCommand.Options) {
		super(context, {
			// All commands use embeds and thus require this permissions
			requiredClientPermissions: new Permissions(options.requiredClientPermissions).add(PermissionFlagsBits.EmbedLinks),
			generateDashLessAliases: true,
			...options
		});
	}

	public error(message: string | UserError, context?: unknown): never {
		throw typeof message === 'string' ? new UserError({ message, context, identifier: 'CustomUserError' }) : message;
	}

	public get client() {
		return this.container.client;
	}
}
