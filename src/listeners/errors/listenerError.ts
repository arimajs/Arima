import { Listener, type Events, type ListenerErrorPayload } from '@sapphire/framework';
import { bold, redBright } from 'colorette';

export class ListenerErrorListener extends Listener<typeof Events.ListenerError> {
	public run(error: Error, { piece }: ListenerErrorPayload) {
		this.container.logger.fatal(`${redBright(bold(`[${piece.name}]`))} ${error.stack || error.message}`);
	}
}
