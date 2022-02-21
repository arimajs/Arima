import type { Message } from 'discord.js';
import { BrandingColor } from '#types/Enums';
import { ArimaCommand } from '#structures/ArimaCommand';
import { ApplyOptions } from '@sapphire/decorators';
import { createEmbed } from '#utils/responses';
import { inlineCode } from '@discordjs/builders';

@ApplyOptions<ArimaCommand.Options>({
	description: 'View my latency!',
	chatInputCommand: {
		register: true,
		idHints: ['937409132519129088']
	}
})
export class UserCommand extends ArimaCommand {
	public override async chatInputRun(interaction: ArimaCommand.Interaction) {
		const embed = createEmbed('', BrandingColor.Secondary).setTitle('Ping? 🏓');
		const message = (await interaction.reply({ embeds: [embed], fetchReply: true })) as Message;

		const botLatency = Math.round(this.client.ws.ping);
		const apiLatency = message.createdTimestamp - message.createdTimestamp;

		const displays = [
			['Bot Latency', botLatency],
			['API Latency', apiLatency]
		].map(([name, value]) => `${name} ➡️ ${inlineCode(`${value.toString()}ms`)}`);

		const updatedEmbed = embed.setColor(BrandingColor.Primary).setTitle('Pong! 🏓').setDescription(displays.join('\n'));
		await interaction.editReply({ embeds: [updatedEmbed] });
	}
}
