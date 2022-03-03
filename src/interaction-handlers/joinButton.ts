import type { ButtonInteraction } from 'discord.js';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { CustomIds, EmbedColor } from '#types/Enums';
import { createEmbed } from '#root/lib/utils/responses';

@ApplyOptions<InteractionHandler.Options>({ interactionHandlerType: InteractionHandlerTypes.Button })
export class UserInteractionHandler extends InteractionHandler {
	public override parse(interaction: ButtonInteraction) {
		const [customId, guildId] = interaction.customId.split('|');
		if (customId === CustomIds.Join) {
			return this.some({ user: interaction.user.id, guild: guildId });
		}
		return this.none();
	}

	public async run(interaction: ButtonInteraction, parsedData: InteractionHandler.ParseResult<this>) {
		const game = this.container.games.get(parsedData.guild);
		if (!game) {
			return;
		}

		game.players.set(parsedData.user, { lastGameEntryTime: Date.now(), totalPlayTime: 0, songsListenedTo: 0, id: parsedData.user });
		const embed = createEmbed('Enjoy the game!', EmbedColor.Secondary);
		await interaction.update({ embeds: [embed], components: [] });
	}
}
