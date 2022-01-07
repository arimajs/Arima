import type { VoiceServerUpdate } from '@skyra/audio';
import { GatewayDispatchEvents } from 'discord-api-types/v9';
import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';

@ApplyOptions<Listener.Options>({ event: GatewayDispatchEvents.VoiceServerUpdate, emitter: 'ws' })
export class UserListener extends Listener {
	public async run(data: VoiceServerUpdate) {
		try {
			await this.container.audio.voiceServerUpdate(data);
		} catch (error) {
			this.container.logger.error(error);
		}
	}
}
