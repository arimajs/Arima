import type { ChatInputCommandErrorPayload } from '@sapphire/framework';
import { Listener, Events, UserError } from '@sapphire/framework';
import { bold, redBright } from 'colorette';
import { sendError } from '#utils/responses';

export class UserEvent extends Listener<typeof Events.ChatInputCommandError> {
	public run(error: Error, { command, interaction }: ChatInputCommandErrorPayload) {
		if (error instanceof UserError) {
			return sendError(interaction, error.message);
		}

		this.container.logger.fatal(`${redBright(bold(`[${command.name}]`))}\n${error.stack || error.message}`);
		return sendError(interaction, 'Something went wrong');
	}
}
