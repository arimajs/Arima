import type { CommandInteraction } from 'discord.js';
import { Precondition } from '@sapphire/framework';

// Discord slash command permissions v1 are currently deprecated, so
// a precondition is used instead of hardcoding user IDs.
// This may change with permissions v2
export class UserPrecondition extends Precondition {
	public override async chatInputRun(interaction: CommandInteraction) {
		if (!this.container.client.application!.owner) {
			await this.container.client.application!.fetch();
		}

		return this.container.client.application!.owner?.id === interaction.user.id
			? this.ok()
			: this.error({ message: 'This command can only be used by my owner' });
	}
}
