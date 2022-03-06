import { Listener, UserError, type Events, type ChatInputCommandDeniedPayload } from '@sapphire/framework';
import { sendError } from '#utils/responses';

export class ChatInputCommandDeniedListener extends Listener<typeof Events.ChatInputCommandDenied> {
	public run(error: UserError, { interaction }: ChatInputCommandDeniedPayload) {
		// eslint-disable-next-line no-new-object
		if (Reflect.get(new Object(error.context), 'silent')) {
			return;
		}

		return sendError(interaction, error.message);
	}
}
