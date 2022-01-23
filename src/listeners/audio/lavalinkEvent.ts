import { ConnectionEvents, IncomingEventPayload } from '@skyra/audio';
import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';

// The "event" event emits TrackEndEvent, TrackStuckEvent, and
// TrackExceptionEvent (among other things). To separate these handlers into
// different files, the payload type is re-emitted through the client and
// listened to in the corresponding listeners.
@ApplyOptions<Listener.Options>({ event: ConnectionEvents.Event })
export class UserListener extends Listener {
	public run(payload: IncomingEventPayload) {
		this.client.emit(payload.type, payload);
	}
}
