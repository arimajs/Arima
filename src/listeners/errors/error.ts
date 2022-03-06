import { Listener } from '@sapphire/framework';

export class ErrorListener extends Listener {
	public override run(message: string) {
		this.container.client.logger.error(message);
	}
}
