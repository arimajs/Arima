import { Listener, type Events, type ChatInputCommandAcceptedPayload } from '@sapphire/framework';

// Update statistics every time a command is run. The user ID is submitted so we can identify the number of
// unique users using the bot.
export class UserListener extends Listener<typeof Events.ChatInputCommandAccepted> {
	public async run({ command, interaction }: ChatInputCommandAcceptedPayload) {
		// Don't log dev only commands, because the statistics aren't useful.
		if (command.category === 'dev') {
			return;
		}

		await this.container.stats?.postCommand(command.name, interaction.user.id);
	}
}
