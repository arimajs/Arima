import type { CommandInteraction, Guild, Snowflake, GuildTextBasedChannel, User, VoiceChannel, MessageOptions, Message } from 'discord.js';
import type { RoundData } from '#game/RoundData';
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
import { Rank } from '#root/lib/database/entities/Member';

export enum GameType {
	Standard = 'standard'
}

// This setting will be configured per-game by the user, and defaults to
// `AcceptedAnswer.Either`.
export enum AcceptedAnswer {
	Song = 'song',
	Artist = 'artist',
	Either = 'either',
	Both = 'both'
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
	public abstract readonly gameType: GameType;
	public readonly queue: Queue;
	public readonly leaderboard: Leaderboard;
	public readonly streaks: StreakCounter;
	public readonly voiceChannel: VoiceChannel;
	public readonly textChannel: GuildTextBasedChannel;
	public readonly hostUser: User;
	public readonly guild: Guild;
	public readonly acceptedAnswer: AcceptedAnswer;
	public round!: RoundData;

	/**
	 * The number of points to play to. Optionally provided by the user
	 * per-game.
	 */
	public readonly goal?: number;
	public players: Map<Snowflake, Player>;

	private readonly startTime = Date.now();

	public constructor(data: GameData) {
		this.textChannel = data.textChannel;
		this.voiceChannel = data.voiceChannel;
		this.hostUser = data.hostUser;
		this.acceptedAnswer = data.acceptedAnswer ?? AcceptedAnswer.Either;
		this.goal = data.goal;
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
			answerTypeString = this.acceptedAnswer;
		} else {
			const conjunction = this.acceptedAnswer === AcceptedAnswer.Both ? 'and' : 'or';
			answerTypeString = `song ${italic(conjunction)} artist`;
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

	// This may become abstract later if the different modes should score differently
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
						content += ` You also ranked up from ${bold(`${Rank[originalRank]} Musician`)} to ${bold(
							`${Rank[member.rank]} Musician`
						)} thanks to your epic song-guessing skills!`;
					}

					promises.push(this.textChannel.send(content));
				}
			}

			// Resolve/reject promises in parallel to boost performance.
			await Promise.all([Promise.all(promises), container.db.em.flush()]);
		}
	}

	// These might be changed from abstract if it turns out there is common behaviour between the sub classes
	/**
	 * Handles a single guess in the form of a Message
	 */
	public abstract guess(guessMessage: Message): Promise<void>;

	/**
	 * Handles game-specific behaviour for when the track ends
	 */
	public abstract onTrackEnd(): Promise<void>;

	/**
	 * Appends user to first guessedArtist list they haven't guessed
	 * Returns true if a player guesses the primary artist
	 */
	protected processArtistGuess(guess: string, user: Snowflake) {
		for (const [artist, guessers] of this.round.artistGuessers.entries()) {
			if (guessers.includes(user)) {
				continue;
			}

			const match = guess === artist || jaroWinkler(guess, artist) >= kGuessThreshold;
			if (match) {
				guessers.push(user);
				return artist === this.round.primaryArtist;
			}
		}

		return false;
	}

	/**
	 * Appends user to guessedSong list if they haven't guessed it
	 * Returns true if the player guesses the song name
	 */
	protected processSongGuess(guess: string, user: Snowflake) {
		// Don't process if they've already guessed it
		if (this.round.songGuessers.includes(user)) {
			return false;
		}

		// Try a bunch of different variations to try to match the most accurate track name.
		const { validSongVariations } = this.round;

		// The guess is valid if it's an exact match or very close to any variation.
		const match = validSongVariations.includes(guess) || validSongVariations.some((str) => jaroWinkler(guess, str) >= kGuessThreshold);
		if (match) {
			// eslint-disable-next-line unicorn/consistent-destructuring
			this.round.songGuessers.push(user);
		}

		return match;
	}
}
