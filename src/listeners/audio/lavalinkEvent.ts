import type { IncomingEventPayload } from '@skyra/audio';
import { ApplyOptions } from '@sapphire/decorators';
import { container, Listener } from '@sapphire/framework';

// The "event" event emits TrackEnd, TrackStuck, and TrackException (among other
// things). To separate these handlers into different files, the payload type is
// re-emitted through the client and listened to in the corresponding listeners.
@ApplyOptions<Listener.Options>({ emitter: container.audio, event: 'event' })
export class UserListener extends Listener {
	public run(payload: IncomingEventPayload) {
		this.client.emit(payload.type, payload);
	}
}
