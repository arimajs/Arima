import { container, Listener, LogLevel, type Events, type ChatInputCommandSuccessPayload } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { bold, cyan } from 'colorette';

@ApplyOptions<Listener.Options>({
	enabled: container.logger.has(LogLevel.Debug)
})
export class UserListener extends Listener<typeof Events.ChatInputCommandSuccess> {
	public override run(payload: ChatInputCommandSuccessPayload) {
		const author = payload.interaction.user;
		const message = `${cyan(bold(`[/${payload.command.name}]`))} - Command executed by ${author.tag} (${author.id})`;
		this.container.logger.debug(message);
	}
}
