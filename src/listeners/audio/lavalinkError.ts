import { ConnectionEvents } from '@skyra/audio';
import { bold, redBright } from 'colorette';
import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';

@ApplyOptions<Listener.Options>({ event: ConnectionEvents.Error })
export class LavalinkErrorListener extends Listener {
	public run(error: Error) {
		this.container.logger.fatal(`${redBright(bold('[LAVALINK]'))} ${error.stack || error.message}`);
	}
}
