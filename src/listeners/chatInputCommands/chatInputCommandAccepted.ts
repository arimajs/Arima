import { Listener, type Events, type ChatInputCommandAcceptedPayload } from '@sapphire/framework';

// Update statistics every time a command is run. The user ID is submitted so we can identify the number of
// unique users using the bot.
export class UserListener extends Listener<typeof Events.ChatInputCommandAccepted> {
	public async run({ command, interaction }: ChatInputCommandAcceptedPayload) {
		await this.container.stats?.postCommand(command.name, interaction.user.id);
	}
}
