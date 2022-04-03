/* eslint-disable @typescript-eslint/member-ordering */
import type { Member } from '#entities/Member';
import { QueryOrder, type FilterQuery, type FindOptions, type EntityField } from '@mikro-orm/core';
import { bold, inlineCode, userMention } from '@discordjs/builders';
import { CommandOptionsRunTypeEnum } from '@sapphire/framework';
import { rankToString, toPercent } from '#utils/common';
import { createEmbed, sendError } from '#utils/responses';
import { UseRequestContext } from '#utils/decorators';
import { PaginatedMessage } from '@sapphire/discord.js-utilities';
import { ArimaCommand } from '#structures/ArimaCommand';
import { ApplyOptions } from '@sapphire/decorators';
import { chunk } from '@sapphire/utilities';

@ApplyOptions<ArimaCommand.Options>({
	description: "View this server's leaderboard!",
	runIn: [CommandOptionsRunTypeEnum.GuildText],
	chatInputCommand: {
		register: true,
		idHints: ['937411028780736642']
	}
})
export class LeaderboardCommand extends ArimaCommand {
	@UseRequestContext()
	public override async chatInputRun(interaction: ArimaCommand.Interaction<'cached'>) {
		const { members } = this.container.db;

		const baseQuery: FilterQuery<Member> = { guildId: interaction.guild.id };
		const baseOptions: FindOptions<Member> = { limit: 30 };
		const baseFields: EntityField<Member>[] = ['userId'];

		const rankLeaderboardQuery = members.find(
			{ ...baseQuery, gamesPlayed: { $gt: 0 } },
			{ ...baseOptions, fields: [...baseFields, 'gamesPlayed', 'gamesWon'], orderBy: { gamesWon: QueryOrder.DESC } }
		);

		const pointLeaderboardQuery = members.find(
			{ ...baseQuery, points: { $gt: 0 } },
			{ ...baseOptions, fields: [...baseFields, 'points', 'level'], orderBy: { points: QueryOrder.DESC } }
		);

		const [rankLeaderboard, pointLeaderboard] = await Promise.all([rankLeaderboardQuery, pointLeaderboardQuery]);

		if (!rankLeaderboard.length && !pointLeaderboard.length) {
			return sendError(interaction, 'No members have played any games yet');
		}

		const paginatedMessage = new PaginatedMessage({
			template: createEmbed()
		});

		// Only 10 entries of each leaderboard should be shown per page.
		const rankChunks = chunk(rankLeaderboard, 10);
		const pointChunks = chunk(pointLeaderboard, 10);

		// Loop as many times as it takes for all of the longest leaderboard to be shown.
		for (let i = 0; i < Math.max(rankChunks.length, pointChunks.length); i++) {
			const ranks = rankChunks[i];
			const points = pointChunks[i];

			paginatedMessage.addPageEmbed((embed) => {
				embed.description = '';

				if (ranks?.length) {
					const gamesWonDisplay = ranks.map((member, index) => {
						const gamesInfoPercent = toPercent(member.gamesWon / member.gamesPlayed);
						const gamesInfoDisplay = `${member.gamesWon}/${member.gamesPlayed} (${gamesInfoPercent})`;
						return `${rankToString(index + 1)} ${userMention(member.userId)} • ${inlineCode(gamesInfoDisplay)}`;
					});

					// Add trailing newlines to separate from the potential point leaderboard below. Discord will trim
					// them off for us if there isn't one.
					embed.description += `🏆 ${bold('Games Won Leaderboard')}\n\n${gamesWonDisplay.join('\n')}\n\n`;
				}

				if (points?.length) {
					const pointsDisplay = points.map((member, index) => {
						const pointDisplay = `${member.points} (level ${member.level})`;
						return `${rankToString(index + 1)} ${userMention(member.userId)} • ${inlineCode(pointDisplay)}`;
					});

					embed.description += `⭐ ${bold('Point Leaderboard')}\n\n${pointsDisplay.join('\n')}`;
				}

				return embed;
			});
		}

		return paginatedMessage.run(interaction);
	}
}
