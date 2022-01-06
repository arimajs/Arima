import { Command, UserError, type Args, type Piece } from '@sapphire/framework';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import { Permissions } from 'discord.js';

export abstract class ArimaCommand<O extends ArimaCommand.Options = ArimaCommand.Options> extends Command<Args, O> {
	public constructor(context: Piece.Context, options: O) {
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

export namespace ArimaCommand {
	// Convenience type to save imports.
	export type Options = Command.Options;
}
