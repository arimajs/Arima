import { Listener } from '@sapphire/framework';

export class UserListener extends Listener {
	public override run(message: string) {
		this.container.client.logger.error(message);
	}
}
