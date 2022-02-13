import type { CommandInteraction, Guild, Snowflake, GuildTextBasedChannel, User, VoiceChannel, MessageOptions, Message } from 'discord.js';
import type { Playlist } from '#utils/audio';
import { bold, inlineCode, italic, userMention } from '@discordjs/builders';
import { DurationFormatter, Time } from '@sapphire/time-utilities';
import { UseRequestContext } from '#utils/decorators';
import { StreakCounter } from '#game/StreakCounter';
import { jaroWinkler } from '@skyra/jaro-winkler';
import { Leaderboard } from '#game/Leaderboard';
import { createEmbed } from '#utils/responses';
import { container } from '@sapphire/framework';
import { Queue } from '#game/Queue';
import { RoundData } from '#game/RoundData';

// GameType.Any is intended to be used for checks only, not as a property of Game
export enum GameType {
	Standard = 'standard',
	Any = 'any'
}

// This setting will be configured per-game by the user, and defaults to
// `AcceptedAnswer.Either`.
export enum AcceptedAnswer {
	Song = 'song',
	Artist = 'artist',
	Either = 'either',
	Both = 'both',
	Neither = 'neither'
}

// Descriptions for each reason are located where they are used to end the game.
export enum GameEndReason {
	HostLeft,
	PlaylistEnded,
	GoalMet,
	TextChannelDeleted,
	GuildInaccessible,
	Other
}

export interface GameData {
	textChannel: GuildTextBasedChannel;
	voiceChannel: VoiceChannel;
	hostUser: User;
	playlist: Playlist;
	acceptedAnswer?: AcceptedAnswer;
	goal?: number;
}

// More info located in voiceStateUpdate listener.
export interface Player {
	lastGameEntryTime?: number;
	totalPlayTime: number;
	songsListenedTo: number;
	id: Snowflake;
}

// Might be changed in the future after more testing.
const kGuessThreshold = 0.75 as const;
const durationFormatter = new DurationFormatter();

export abstract class Game {
	public readonly queue: Queue;
	public readonly leaderboard: Leaderboard;
	public readonly streaks: StreakCounter;
	public readonly voiceChannel: VoiceChannel;
	public readonly textChannel: GuildTextBasedChannel;
	public readonly hostUser: User;
	public readonly guild: Guild;
	public readonly acceptedAnswer: AcceptedAnswer;
	public readonly gameType: GameType;
	public readonly roundData: RoundData;
	/**
	 * The number of points to play to. Optionally provided by the user
	 * per-game.
	 */
	public readonly goal?: number;
	public players: Map<Snowflake, Player>;

	private readonly startTime = Date.now();

	public constructor(data: GameData, gameType: GameType) {
		this.textChannel = data.textChannel;
		this.voiceChannel = data.voiceChannel;
		this.hostUser = data.hostUser;
		this.acceptedAnswer = data.acceptedAnswer ?? AcceptedAnswer.Either;
		this.goal = data.goal;
		this.gameType = gameType;
		this.roundData = new RoundData();
		this.guild = this.textChannel.guild;
		this.queue = new Queue(this, data.playlist);
		this.leaderboard = new Leaderboard();
		this.streaks = new StreakCounter();

		const players = this.voiceChannel.members
			.filter(({ user }) => !user.bot)
			.map<[Snowflake, Player]>((member) => [
				member.id,
				{ id: member.id, lastGameEntryTime: Date.now(), totalPlayTime: 0, songsListenedTo: 0 }
			]);

		this.players = new Map(players);
	}

	public start(interaction: CommandInteraction) {
		let answerTypeString = '';
		if ([AcceptedAnswer.Song, AcceptedAnswer.Artist].includes(this.acceptedAnswer)) {
			answerTypeString = this.acceptedAnswer.toLowerCase();
		} else {
			const and_or = this.acceptedAnswer === AcceptedAnswer.Both ? 'and' : 'or';
			answerTypeString = `song ${italic(and_or)} artist`;
		}

		const description = `The game has begun! You have ${inlineCode('30')} seconds to guess the name of the ${answerTypeString} in this channel.`;
		const embed = createEmbed(description)
			.setAuthor({ name: `Hosted by ${this.hostUser.tag}`, iconURL: this.hostUser.displayAvatarURL({ size: 128, dynamic: true }) })
			.setTitle(`🎶 Playing the playlist "${this.queue.playlist.name}"`);

		if (this.goal) {
			embed.setFooter({ text: `Playing to ${this.goal} points` });
		}

		return Promise.all([this.queue.next(), interaction.editReply({ embeds: [embed] })]);
	}

	// might change this later if the different modes should score differently
	@UseRequestContext()
	public async end(reason: GameEndReason, sendFn: (options: MessageOptions) => Promise<unknown> = this.textChannel.send.bind(this.textChannel)) {
		container.games.delete(this.guild.id);
		await this.queue.end();

		if (reason === GameEndReason.GuildInaccessible) {
			return;
		}

		let leader: User | null = null;
		const leaderId = this.leaderboard.leader?.[0];
		if (leaderId) {
			leader = await container.client.users.fetch(leaderId).catch(() => null);
		}

		if (reason !== GameEndReason.TextChannelDeleted) {
			const descriptions = {
				[GameEndReason.GoalMet]: `The goal of **${this.goal}** 🥅 was hit!`,
				[GameEndReason.HostLeft]: `The game ended because the host left the voice channel 😓`,
				[GameEndReason.PlaylistEnded]: `We ran through every song in the playlist! 🎶`,
				[GameEndReason.Other]: `Good game! 🥳`
			};

			const embed = createEmbed(descriptions[reason])
				.setThumbnail(leader?.displayAvatarURL({ dynamic: true, size: 256 }) ?? '')
				.setTitle(this.leaderboard.leader ? `🎉 ${leader?.tag ?? 'An unknown user'} won 🎉` : '😔 Nobody won')
				.addField('Time Elapsed', durationFormatter.format(Date.now() - this.startTime).toString(), true)
				.addField('Tracks Played', inlineCode(this.queue.tracksPlayed.toString()), true)
				.addField('Leaderboard (Top 10)', this.leaderboard.compute())
				.setFooter({ text: 'Nice job! Play again sometime :)' });

			await sendFn({ embeds: [embed] });
		}

		// If one or less song was played, it's not worth making database calls.
		if (this.queue.tracksPlayed > 1) {
			const existingMembers = await container.db.members.find({ userId: { $in: [...this.players.keys()] }, guildId: this.guild.id });
			const promises: Promise<Message>[] = [];

			for (const player of this.players.values()) {
				const songsGuessedCorrectly = this.leaderboard.get(player.id) ?? 0;

				let timePlayed = player.totalPlayTime;

				// If the player is still in the voice channel, add to their time played.
				if (player.lastGameEntryTime) {
					timePlayed += Date.now() - player.lastGameEntryTime;
				}

				const isWinner = player.id === leader?.id;
				const multiplier = isWinner ? 1500 : 1000;

				const points = Math.round((songsGuessedCorrectly / player.songsListenedTo) * (timePlayed / Time.Minute) * multiplier);

				const existingMember = existingMembers.find(({ userId }) => userId === player.id);
				const member = existingMember ?? container.db.members.create({ userId: player.id, guildId: this.guild.id });

				const originalLevel = member.level;
				member.points += points;

				const originalRank = member.rank;
				member.gamesPlayed++;

				if (isWinner) {
					member.gamesWon++;
				}

				if (!existingMember) {
					container.db.em.persist(member);
				}

				const rankedUp = originalRank !== member.rank;
				if (reason !== GameEndReason.TextChannelDeleted && (songsGuessedCorrectly || rankedUp)) {
					let content = `${userMention(player.id)}, thanks for playing! You listened to ${
						player.songsListenedTo
					} songs, guessed ${songsGuessedCorrectly} of them correctly, `;

					content +=
						originalLevel === member.level
							? `and earned ${points} points.`
							: `earned ${points} points, and have reached level ${member.level}! 🥳`;

					if (rankedUp) {
						content += ` You also ranked up from ${originalRank} musician to ${bold(
							`${member.rank} musician`
						)} thanks to your epic song-guessing skills!`;
					}

					promises.push(this.textChannel.send(content));
				}
			}

			// Resolve/reject promises in parallel to boost performance.
			await Promise.all([Promise.all(promises), container.db.em.flush()]);
		}
	}

	// will potentially make these not abstract and put common behaviour here
	public abstract guess(guessMessage: Message): void;
	public abstract onTrackEnd(): void;
	public abstract guessAnswer(guess: string, user: User): void;

	// returns true if new player guesses the artist
	protected guessArtist(guess: string, user: User) {
		for (const artist of Object.keys(this.roundData.trackArtistsGuessed)) {
			if (this.roundData.trackArtistsGuessed[artist].has(user)) {
				return false;
			}
			const match = guess === artist || jaroWinkler(guess, artist) >= kGuessThreshold;
			if (match) {
				this.roundData.trackArtistsGuessed[artist].add(user);
				return true;
			}
		}
		return false;
	}

	// returns true if new player guesses the song title
	protected guessSong(guess: string, user: User) {
		// don't process if they've already guessed it
		if (this.roundData.playersGuessedTrackName.has(user)) {
			return false;
		}
		// Try a bunch of different variations to try to match the most accurate track name.
		const validSongVariations = this.roundData.validTrackNames;

		// The guess is valid if it's an exact match or very close to any variation.
		const match = validSongVariations.includes(guess) || validSongVariations.some((str) => jaroWinkler(guess, str) >= kGuessThreshold);
		if (match) {
			this.roundData.playersGuessedTrackName.add(user);
		}
		return match;
	}
}
