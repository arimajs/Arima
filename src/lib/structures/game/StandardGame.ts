import { Collection, CommandInteraction, GuildMember, Message, MessageEmbed, Snowflake, TextBasedChannel, TextChannel } from 'discord.js';
import { EmbedColor, AcceptedAnswer } from '#types/Enums';
import { cleanName, resolveThumbnail } from '#utils/audio';
import { createEmbed } from '#utils/responses';
import { Game, Player } from '#game/Game';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import { bold, userMention } from '@discordjs/builders';
import { Gametype } from '#game/Gametypes';

export class StandardGame extends Game {
	public readonly gametype = Gametype.Standard;

	public async guess(message: Message) {
		const guess = cleanName(message.content);
		const guessedBefore = this.guessedThisRound();
		const guessedNow = this.processGuess(guess, message.author.id);

		if (!guessedNow) {
			return;
		}

		const isHalfGuessed = this.acceptedAnswer === AcceptedAnswer.Both && !guessedBefore && guessedNow;

		let halfGuessedString = '';
		if (isHalfGuessed) {
			const { title, author } = this.queue.nowPlaying!.info;
			const guessedNameString = guessedNow === AcceptedAnswer.Song ? title : author;
			halfGuessedString = ` The ${guessedNow}'s name is ${bold(guessedNameString)}. You're halfway there!`;
		}

		const embed = createEmbed(`✅ You got it!${halfGuessedString}`);

		const promises: Promise<unknown>[] = [];
		promises.push(message.channel.send({ embeds: [embed] }));

		if (!isHalfGuessed) {
			promises.push(this.queue.player.stop());
		}

		await Promise.all(promises);
	}

	public async onTrackEnd() {
		const everybodyPassed = this.round.passedPlayers.size === this.players.size;
		const { tracksPlayed, playlistLength, nowPlaying } = this.queue;
		let embedFooter = `${tracksPlayed}/${playlistLength}`;
		let embedDescription = everybodyPassed ? 'Everybody passed! 🏃' : 'Nobody guessed it! 🙁 That was a hard one!';

		if (!everybodyPassed) {
			const { songGuessers, primaryArtistGuessers } = this.round;

			// Ensure players are only in here once.
			const guessers = [...new Set([...songGuessers, ...primaryArtistGuessers])];
			const numGuessers = guessers.length;
			const requiresBoth = this.acceptedAnswer === AcceptedAnswer.Both;
			const doubleGuesser = requiresBoth && numGuessers === 1 && songGuessers.size && primaryArtistGuessers.size;

			// 3 cases that the song was 'guessed':
			//   - someone got it (one or either of artist or song)
			//   - 1 person got both
			//   - two different people got 1 each
			const guessed = (!requiresBoth && numGuessers) || doubleGuesser || numGuessers === 2;

			if (guessed) {
				if (numGuessers === 1) {
					this.leaderboard.inc(guessers[0]);
				} else {
					// There should only ever be 2 guessers but made generic anyway.
					for (const guesser of guessers) {
						this.leaderboard.inc(guesser, 1 / numGuessers);
					}
				}

				this.streaks.incStreak(...guessers);

				embedDescription = `${doubleGuesser ? guessers[0] : guessers.join(' and ')} guessed it!`;
			} else {
				const guessedThisRound = this.guessedThisRound();
				if (guessedThisRound) {
					embedDescription = `Only the ${guessedThisRound} was guessed! 🙁`;
				}
			}

			const [streakLeaderId, streak] = this.streaks.leader ?? [];

			// If there is a streak leader, it must be one of the guessers.
			const streakLeader = streak && guessers.find((id) => id === streakLeaderId);
			if (streakLeader) {
				embedFooter += ` • ${userMention(streakLeaderId)} has a streak of ${streak} 🔥`;
			}
		}

		if (this.goal && !this.limit) {
			embedFooter += ` • Playing to ${this.goal} points`;
		} else if (this.limit && !this.goal) {
			embedFooter += ` • Playing to ${this.limit} songs`;
		} else if (this.limit && this.goal) {
			embedFooter += ` • Playing to ${this.goal} points or ${this.limit} songs`;
		}

		const { title, author, uri, color } = nowPlaying!.info;

		const embed = createEmbed(embedDescription, EmbedColor.Secondary)
			.setURL(uri)
			.setTitle(`That was "${title}" by ${author}`)
			.addField('Leaderboard', this.leaderboard.compute())
			.setFooter({ text: embedFooter });

		if (color) {
			embed.setColor(color);
		}

		const thumbnail = resolveThumbnail(nowPlaying!.info);
		if (thumbnail) {
			embed.setThumbnail(thumbnail);
		}

		await this.textChannel.send({ embeds: [embed] });
	}

	public validGuessChannel(channel: TextBasedChannel) {
		const textChannel = channel as TextChannel;
		return this.textChannel.id === channel.id && this.textChannel.permissionsFor(textChannel.guild.me!).has(PermissionFlagsBits.EmbedLinks);
	}

	protected calcPointsDivisor(songsListenedTo: number) {
		return songsListenedTo;
	}

	protected getPlayers(voiceChannelMembers: Collection<string, GuildMember>) {
		const basePlayer: Omit<Player, 'id'> = { lastGameEntryTime: Date.now(), totalPlayTime: 0, songsListenedTo: 0 };
		this.players = new Collection(voiceChannelMembers.map<[Snowflake, Player]>((member) => [member.id, { ...basePlayer, id: member.id }]));
	}

	protected async sendStartEmbed(embed: MessageEmbed, interaction: CommandInteraction) {
		await interaction.editReply({ embeds: [embed] });
	}

	/**
	 * Processes a guess returning whether either the song name or primary artist was guessed.
	 */
	private processGuess(guess: string, user: Snowflake) {
		switch (this.acceptedAnswer) {
			case AcceptedAnswer.Song: {
				return this.processSongGuess(guess, user) ? AcceptedAnswer.Song : null;
			}

			case AcceptedAnswer.Artist: {
				return this.processArtistGuess(guess, user) === this.round.primaryArtist ? AcceptedAnswer.Artist : null;
			}

			case AcceptedAnswer.Either: {
				break;
			}

			case AcceptedAnswer.Both: {
				// If the song is guessed, guess the artists.
				if (this.round.songGuessers.size) {
					return this.processArtistGuess(guess, user) ? AcceptedAnswer.Artist : null;
				}

				// If neither is already guessed, guess either.
				break;
			}
		}

		// Guessing either is common to AcceptedAnswer.Either and AcceptedAnswer.Both.
		if (this.processArtistGuess(guess, user)) {
			return AcceptedAnswer.Artist;
		}

		if (this.processSongGuess(guess, user)) {
			return AcceptedAnswer.Song;
		}

		return null;
	}

	private guessedThisRound() {
		// Check if someone guessed song name or primary artist.
		if (this.round.songGuessers.size) {
			return AcceptedAnswer.Song;
		}

		if (this.round.primaryArtistGuessers.size) {
			return AcceptedAnswer.Artist;
		}

		return null;
	}
}
