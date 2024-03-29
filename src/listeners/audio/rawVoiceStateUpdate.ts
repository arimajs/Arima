import { GatewayDispatchEvents, type GatewayVoiceState } from 'discord-api-types/v9';
import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';

@ApplyOptions<Listener.Options>({ event: GatewayDispatchEvents.VoiceStateUpdate, emitter: 'ws' })
export class RawVoiceStateListener extends Listener {
	public async run(data: GatewayVoiceState) {
		try {
			await this.container.audio.voiceStateUpdate(data);
		} catch (error) {
			this.container.logger.error(error);
		}
	}
}
