import { Listener, type Events, type ChatInputCommandAcceptedPayload } from '@sapphire/framework';

export class UserListener extends Listener<typeof Events.ChatInputCommandAccepted> {
	public async run({ command, interaction }: ChatInputCommandAcceptedPayload) {
		// Update statistics every time a command is run. The user ID is
		// submitted so we can identify the number of unique users using the
		// bot.
		await this.container.stats?.postCommand(command.name, interaction.user.id);
	}
}
