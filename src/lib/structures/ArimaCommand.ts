import { Command, type Args, type Piece } from '@sapphire/framework';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import { Permissions } from 'discord.js';
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
			// Enable it only if there is a development server on the assumption
			// it would've been registered guild wide otherwise.
			this.enabled &&= Boolean(env.DEV_SERVER_ID);

			// Automatically enable the OwnerOnly precondition.
			this.preconditions.append('OwnerOnly');
		}
	}
}

export namespace ArimaCommand {
	// Convenience type to save imports.
	export type Options = Command.Options;
}
