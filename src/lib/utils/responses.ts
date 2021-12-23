/* eslint-disable @typescript-eslint/no-invalid-void-type */
import type { ColorResolvable, CommandInteraction } from 'discord.js';
import { BrandingColors } from '#utils/constants';
import { MessageEmbed } from 'discord.js';

/**
 * Creates an embed
 */
export const createEmbed = (description: string, color: ColorResolvable = BrandingColors.Primary) => {
	return new MessageEmbed({ color, description });
};

/**
 * Sends an error response from an interaction
 */
export const sendError = (interaction: CommandInteraction, description: string) => {
	return interaction.reply({
		// Core sapphire errors end in ".", so that needs to be accounted for
		embeds: [createEmbed(`❌ ${description.endsWith('.') ? description.slice(0, -1) : description}!`)],
		ephemeral: true
	});
};

// ! Make sure to use this method of resolving Message/APIMessage if channel or guild sweeping is implemented
// ! Until then, we can safely cast as `Message` whe using the `fetchReply` option
// ! Note that the `Message` constructor has been private since v13.2.0 (https://github.com/discordjs/discord.js/pull/6732)
// ! So the Reflect.construct hack is necessary (alternative to @ts-ignore)

// /**
//  * Resolves a Message object from the sending of an interaction
//  */
// export const replyAndFetch = async (interaction: CommandInteraction, options: Omit<Parameters<CommandInteraction['reply']>, 'fetchReply'>) => {
// 	const message = await interaction.reply({ ...options, fetchReply: true });
// 	return message instanceof Message ? message : Reflect.construct(Message, [interaction.client, message]);
// };
