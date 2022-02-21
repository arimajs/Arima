import { CommandInteraction, Team } from 'discord.js';
import { Precondition } from '@sapphire/framework';

// Discord slash command permissions are in the process of a overhaul, but currently, it's just easier to use
// preconditions. As of now, there are no "global" slash command permissions, which means, to restrict a command to a
// specific user, you must restrict it in *every* single guild the bot is in.
export class UserPrecondition extends Precondition {
	public override async chatInputRun(interaction: CommandInteraction) {
		if (!this.client.application!.owner) {
			await this.client.application!.fetch();
		}

		// `application.owner` is guarranteed to be populated after the above fetch.
		const owner = this.client.application!.owner!;

		// It will be a (partial) user or a team, and if it's a team, we should allow access to every member.
		return (owner instanceof Team ? owner.members.has(interaction.user.id) : interaction.user.id === owner.id)
			? this.ok()
			: this.error({ message: 'This command can only be used by my owner' });
	}
}
