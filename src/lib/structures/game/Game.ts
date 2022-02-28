import type {
	CommandInteraction,
	Guild,
	Snowflake,
	GuildTextBasedChannel,
	User,
	VoiceChannel,
	MessageOptions,
	Message,
	GuildMember,
	TextBasedChannel
} from 'discord.js';
import type { RoundData } from '#game/RoundData';
import type { Playlist } from '#utils/audio';
import { PlaylistType, AcceptedAnswer, GameEndReason, GameType } from '#types/Enums';
import { bold, inlineCode, italic, userMention } from '@discordjs/builders';
import { DurationFormatter, Time } from '@sapphire/time-utilities';
import { prefixAndPluralize } from '#utils/common';
import { UseRequestContext } from '#utils/decorators';
import { StreakCounter } from '#game/StreakCounter';
import { jaroWinkler } from '@skyra/jaro-winkler';
import { Leaderboard } from '#game/Leaderboard';
import { createEmbed } from '#utils/responses';
import { AsyncQueue } from '@sapphire/async-queue';
import { container } from '@sapphire/framework';
import { Queue } from '#game/Queue';
import { Collection } from 'discord.js';
import { StandardGame } from '#game/StandardGame';
import { BinbGame } from '#game/BinbGame';

export interface GameData {
	textChannel: GuildTextBasedChannel;
	voiceChannel: VoiceChannel;
	host: User;
	playlist: Playlist;
	acceptedAnswer?: AcceptedAnswer;
	goal?: number;
	limit?: number;
}

// More info located in voiceStateUpdate listener.
export interface Player {
	lastGameEntryTime?: number;
	totalPlayTime: number;
	songsListenedTo: number;
	id: Snowflake;
}

export const Games = {
	[GameType.Standard]: StandardGame,
	[GameType.Binb]: BinbGame
};

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
	public readonly host: User;
	public readonly guild: Guild;
	public readonly acceptedAnswer: AcceptedAnswer;
	public readonly guessQueue = new AsyncQueue();
	public round!: RoundData;
	public players = new Collection<Snowflake, Player>();

	/**
	 * The number of points to play to. Optionally provided by the user per-game.
	 */
	public readonly goal?: number;

	/**
	 * The number of songs to play to. Optionally provided by the user per-game.
	 */
	public readonly limit?: number;
	private readonly startTime = Date.now();

	public constructor(data: GameData) {
		this.textChannel = data.textChannel;
		this.voiceChannel = data.voiceChannel;
		this.host = data.host;
		this.acceptedAnswer = data.acceptedAnswer ?? AcceptedAnswer.Either;
		this.goal = data.goal;
		this.limit = data.limit;
		this.guild = this.textChannel.guild;
		this.queue = new Queue(this, data.playlist);
		this.leaderboard = new Leaderboard();
		this.streaks = new StreakCounter();
	}

	public async start(interaction: CommandInteraction) {
		// Moved here because this.getPlayers will probably become async
		const members = this.voiceChannel.members.filter(({ user }) => !user.bot);
		this.players = this.getPlayers(members);

		let answerTypeString = '';
		if ([AcceptedAnswer.Song, AcceptedAnswer.Artist].includes(this.acceptedAnswer)) {
			answerTypeString = this.acceptedAnswer;
		} else {
			const conjunction = this.acceptedAnswer === AcceptedAnswer.Both ? 'and' : 'or';
			answerTypeString = `song ${italic(conjunction)} artist`;
		}

		const { playlist } = this.queue;

		const description = `The game has begun! You have ${inlineCode('30')} seconds to guess the name of the ${answerTypeString} in this channel.`;
		const embed = createEmbed(description)
			.setAuthor({ name: `Hosted by ${this.host.tag}`, iconURL: this.host.displayAvatarURL({ size: 128, dynamic: true }) })
			.setTitle(`🎶 Playing the playlist "${playlist.name}"`)
			.setFooter({ text: "💡 Tip! Use /pass on songs you don't know" });

		if (playlist.type === PlaylistType.Spotify) {
			if (playlist.image) {
				embed.setThumbnail(playlist.image);
			}

			if (playlist.color) {
				embed.setColor(playlist.color);
			}
		}

		if (this.goal) {
			embed.setFooter({ text: `Playing to ${this.goal} points` });
		}

		await Promise.all([this.queue.next(), interaction.editReply({ embeds: [embed] })]);
	}

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
				[GameEndReason.GoalMet]: `The goal of ${inlineCode(this.goal?.toString() ?? 'N/A')} was hit!  🥅`,
				[GameEndReason.LimitReached]: `The limit of ${inlineCode(this.limit?.toString() ?? 'N/A')} songs was reached! 🛑`,
				[GameEndReason.HostLeft]: 'The game ended because the host left the voice channel 😓',
				[GameEndReason.PlaylistEnded]: 'We ran through every song in the playlist! 🎶',
				[GameEndReason.Other]: 'Good game! 🥳'
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
				const score = this.leaderboard.get(player.id) ?? 0;

				let timePlayed = player.totalPlayTime;

				// If the player is still in the voice channel, add to their time played.
				if (player.lastGameEntryTime) {
					timePlayed += Date.now() - player.lastGameEntryTime;
				}

				const isWinner = player.id === leader?.id;
				const multiplier = isWinner && this.players.size > 1 ? 1500 : 1000;

				const points = Math.round((score / this.calcPointsDivisor(player.songsListenedTo)) * (timePlayed / Time.Minute) * multiplier);

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
				if (reason !== GameEndReason.TextChannelDeleted && (score || rankedUp)) {
					let content = `${userMention(player.id)}, thanks for playing! You listened to ${prefixAndPluralize(
						'song',
						player.songsListenedTo
					)}, guessed ${score} of them correctly, `;

					content +=
						originalLevel === member.level
							? `and earned ${points} points.`
							: `earned ${points} points, and have reached level ${member.level}! 🥳`;

					if (rankedUp) {
						const [oldRank, newRank] = [originalRank, member.rank].map((rank) => bold(`${rank} Musician`));
						content += ` You also ranked up from ${oldRank} to ${newRank} thanks to your epic song-guessing skills!`;
					}

					promises.push(this.textChannel.send(content));
				}
			}

			// Resolve/reject promises in parallel to boost performance.
			await Promise.all([Promise.all(promises), container.db.em.flush()]);
		}
	}

	// These might be changed from abstract if it turns out there is common behaviour between the sub classes.
	/**
	 * Handles a single guess in the form of a Message.
	 */
	public abstract guess(guessMessage: Message): Promise<void>;

	/**
	 * @returns if the channel is where guesses are made for this game
	 */
	public abstract validGuessChannel(channel: TextBasedChannel): boolean;

	/**
	 * Handles game-specific behaviour for when the track ends.
	 */
	public abstract onTrackEnd(): Promise<void>;

	/**
	 * Calculates the points divisor for a player
	 * Used in end()
	 */
	protected abstract calcPointsDivisor(songsListenedTo: number): number;

	protected abstract getPlayers(voiceChannelMembers: Collection<string, GuildMember>): Collection<Snowflake, Player>;

	/**
	 * Appends user to first guessedArtist list they haven't guessed.
	 * @returns the artist that was guessed or null if none guessed
	 */
	protected processArtistGuess(guess: string, user: Snowflake) {
		for (const [artist, guessers] of this.round.artistGuessers.entries()) {
			if (guessers.includes(user)) {
				continue;
			}

			const match = guess === artist || jaroWinkler(guess, artist) >= kGuessThreshold;
			if (match) {
				guessers.push(user);
				return artist;
			}
		}

		return null;
	}

	/**
	 * Appends user to guessedSong list if they haven't guessed it.
	 * @returns true if the player guesses the song name.
	 */
	protected processSongGuess(guess: string, user: Snowflake) {
		const { validSongVariations, songGuessers } = this.round;

		// Don't process if they've already guessed it.
		if (songGuessers.includes(user)) {
			return false;
		}

		// Remove all characters that aren't letters or numbers from all variations. It's drastic, but highly increases accuracy.
		const cleaned = guess.replace(/[^\p{L}\p{N}]/gu, '');

		// Try a bunch of different variations to try to match the most accurate track name. The guess is valid if it's
		// an exact match or very close to any variation.
		const match = validSongVariations.includes(cleaned) || validSongVariations.some((str) => jaroWinkler(cleaned, str) >= kGuessThreshold);

		if (match) {
			songGuessers.push(user);
		}

		return match;
	}
}
