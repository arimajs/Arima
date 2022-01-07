import { Listener, UserError, type Events, type ChatInputCommandDeniedPayload } from '@sapphire/framework';
import { sendError } from '#utils/responses';

export class UserEvent extends Listener<typeof Events.ChatInputCommandDenied> {
	public run(error: UserError, { interaction }: ChatInputCommandDeniedPayload) {
		if (Reflect.get(Object(error.context), 'silent')) {
			return;
		}

		return sendError(interaction, error.message);
	}
}