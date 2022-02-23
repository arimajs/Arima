/* eslint-disable @typescript-eslint/no-invalid-void-type */
import { MessageEmbed, type CommandInteraction } from 'discord.js';
import { EmbedColor } from '#types/Enums';

/**
 * Creates an embed.
 */
export const createEmbed = (description?: string, color: EmbedColor = EmbedColor.Primary) => {
	return new MessageEmbed({ color, description });
};

/**
 * Sends an error response from an interaction.
 */
export const sendError = async (interaction: CommandInteraction, description: string, ephemeral = true) => {
	// Core sapphire errors end in ".", so that needs to be accounted for.
	const parsedDescription = `❌ ${description.endsWith('.') ? description.slice(0, -1) : description}!`;
	const payload = {
		embeds: [createEmbed(parsedDescription, EmbedColor.Error)],
		ephemeral
	};

	// eslint-disable-next-line @typescript-eslint/unbound-method
	const replyFn = interaction.replied ? interaction.followUp : interaction.deferred ? interaction.editReply : interaction.reply;
	await replyFn.call(interaction, payload);
};

// This method of resolving `Message` instances from interaction replies should be used if channel or guild sweeping is
// implemented, as it's only guarranteed to return a `Message` if the channel it was sent in is cached (and if the bot
// is in the guild where the message was sent, although we don't need to worry about that). Until then, we can safely
// cast as `Message` when using the `fetchReply` option. Note that the `Message` constructor has been private since
// v13.2.0 (discordjs/discord.js#6732), so the Reflect.construct hack is necessary (@ts-ignore would also work).

// /**
//  * Replies to an interaction and resolves a `Message` instance from the new message.
//  */
// export const replyAndFetch = async (interaction: CommandInteraction, options: Omit<Parameters<CommandInteraction['reply']>, 'fetchReply'>) => {
// 	const message = await interaction.reply({ ...options, fetchReply: true });
// 	return message instanceof Message ? message : Reflect.construct(Message, [interaction.client, message]);
// };
