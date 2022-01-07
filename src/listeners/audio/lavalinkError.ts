import { Listener, container } from '@sapphire/framework';
import { bold, redBright } from 'colorette';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<Listener.Options>({ emitter: container.audio, event: 'error' })
export class UserListener extends Listener {
	public run(error: Error) {
		this.container.logger.fatal(`${redBright(bold('[LAVALINK]'))} ${error.stack || error.message}`);
	}
}
