import type { ButtonInteraction } from 'discord.js';
import type { Player } from '#game/Game';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { CustomIds, EmbedColor } from '#types/Enums';
import { createEmbed } from '#root/lib/utils/responses';

@ApplyOptions<InteractionHandler.Options>({ interactionHandlerType: InteractionHandlerTypes.Button, enabled: false })
export class UserInteractionHandler extends InteractionHandler {
	public override parse(interaction: ButtonInteraction) {
		if (interaction.customId === CustomIds.Join) {
			return this.some(interaction.user.id);
		}

		return this.none();
	}

	public async run(interaction: ButtonInteraction, userID: InteractionHandler.ParseResult<this>) {
		const game = this.container.games.find((game) => game.players.has(userID));
		if (!game) {
			return;
		}

		const player: Player = { lastGameEntryTime: Date.now(), totalPlayTime: 0, songsListenedTo: 0, id: userID };
		game.players.set(userID, player);
		const embed = createEmbed('Enjoy the game!', EmbedColor.Primary);
		await interaction.update({ embeds: [embed], components: [] });
	}
}
