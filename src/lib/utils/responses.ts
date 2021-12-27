/* eslint-disable @typescript-eslint/no-invalid-void-type */
import type { ColorResolvable, CommandInteraction } from 'discord.js';
import { BrandingColors } from '#utils/constants';
import { MessageEmbed } from 'discord.js';

/**
 * Creates an embed.
 */
export const createEmbed = (description: string, color: ColorResolvable = BrandingColors.Primary) => {
	return new MessageEmbed({ color, description });
};

/**
 * Sends an error response from an interaction.
 */
export const sendError = (interaction: CommandInteraction, description: string) => {
	return interaction.reply({
		// Core sapphire errors end in ".", so that needs to be accounted for
		embeds: [createEmbed(`❌ ${description.endsWith('.') ? description.slice(0, -1) : description}!`)],
		ephemeral: true
	});
};

// This method of resolving `Message` instances from interaction replies should
// be used if channel or guild sweeping is implemented, as it's only guarranteed
// to return a `Message` if the channel it was sent in is cached (and if the bot
// is in the guild where the message was sent, although we don't need to worry
// about that). Until then, we can safely cast as `Message` when using the
// `fetchReply` option. Note that the `Message` constructor has been private
// since v13.2.0 (discordjs/discord.js#6732), so the Reflect.construct hack is
// necessary (@ts-ignore would also work).

// /**
//  * Replies to an interaction and resolves a `Message` instance from the new message.
//  */
// export const replyAndFetch = async (interaction: CommandInteraction, options: Omit<Parameters<CommandInteraction['reply']>, 'fetchReply'>) => {
// 	const message = await interaction.reply({ ...options, fetchReply: true });
// 	return message instanceof Message ? message : Reflect.construct(Message, [interaction.client, message]);
// };
