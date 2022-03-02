import {
	Message,
	MessageOptions,
	Collection,
	GuildMember,
	TextBasedChannel,
	MessageButton,
	Constants,
	MessageActionRow,
	MessageEmbed,
	CommandInteraction
} from 'discord.js';
import { AcceptedAnswer, CustomIds, EmbedColor, GameType } from '#types/Enums';
import { cleanName, resolveThumbnail } from '#utils/audio';
import { createEmbed } from '#utils/responses';
import { isDMChannel } from '@sapphire/discord.js-utilities';
import { userMention } from '@discordjs/builders';
import { container } from '@sapphire/framework';
import { Game } from '#game/Game';
import { Time } from '@sapphire/time-utilities';
import { setTimeout } from 'node:timers/promises';

export class BinbGame extends Game {
	public readonly gameType = GameType.Binb;
	public override readonly acceptedAnswer: AcceptedAnswer = AcceptedAnswer.Both;

	public async guess(message: Message) {
		const guess = cleanName(message.content);
		const guesserID = message.author.id;
		let guessed: AcceptedAnswer | null = null;

		if (!this.round.songGuessers.has(guesserID)) {
			guessed = this.processSongGuess(guess, guesserID) ? AcceptedAnswer.Song : null;
		}

		let artistGuessed = null;
		if (!guessed) {
			artistGuessed = this.processArtistGuess(guess, guesserID);
			guessed = artistGuessed ? AcceptedAnswer.Artist : null;
		}

		const promises: Promise<unknown>[] = [];

		if (guessed) {
			const article = guessed === AcceptedAnswer.Artist && artistGuessed !== this.round.primaryArtist ? 'a featuring' : 'the';
			const embed = createEmbed(`✅ You guessed ${article} ${guessed}`);
			promises.push(message.reply({ embeds: [embed] }));
		}

		const guessedBoth = this.round.primaryArtistGuessers.has(guesserID) && this.round.songGuessers.has(guesserID);
		if (guessed && guessedBoth) {
			// User has guessed both the primary artist and song
			const guessTime = ((Date.now() - this.round.startTime) / Time.Second).toFixed(2);
			const embed = createEmbed(`✅ ${message.author.tag} got it in ${guessTime}s!`);
			promises.push(this.messageAllPlayers({ embeds: [embed] }));

			const everyoneGuessedBoth =
				this.round.primaryArtistGuessers.size === this.players.size && this.round.songGuessers.size === this.players.size;
			if (everyoneGuessedBoth) {
				promises.push(this.queue.player.stop());
			}
		}

		await Promise.all(promises);
	}

	public async onTrackEnd() {
		const everybodyPassed = this.round.passedPlayers.size === this.players.size;
		const { tracksPlayed, playlistLength, nowPlaying } = this.queue;
		let embedFooter = `${tracksPlayed}/${playlistLength}`;
		let embedDescription = everybodyPassed ? 'Everybody passed 🏃' : '';

		if (!everybodyPassed) {
			// Give 0.5 points for each of primary artist and song
			const primaryArtistAndSongGuessers = [...this.round.songGuessers, ...this.round.primaryArtistGuessers];
			for (const guesser of primaryArtistAndSongGuessers) {
				this.leaderboard.inc(guesser, 0.5);
			}

			// Give 0.25 points for each 'other' artist
			const otherArtistGuessers = this.round.artistGuessers.values();
			// Skip primary artist
			otherArtistGuessers.next();
			for (const guessers of otherArtistGuessers) {
				for (const guesser of guessers) {
					this.leaderboard.inc(guesser, 0.25);
				}
			}

			// Give bonus points to 1st, 2nd, 3rd double guessers
			const { doubleGuessers } = this.round;
			// Cut back on unnecessary loops if they're aren't more than 3 double guessers.
			const placedSize = Math.min(3, doubleGuessers.length);
			for (let i = 0; i < placedSize; i++) {
				this.leaderboard.inc(doubleGuessers[i], 1.5 - i * 0.5);
			}

			this.streaks.incStreak(...doubleGuessers);

			if (primaryArtistAndSongGuessers.length) {
				// There are players who guessed something
				if (doubleGuessers.length === this.players.size) {
					embedDescription = 'Well done everyone! You all guessed it!';
				} else {
					// Not everyone got the answer, check if anyone got it
					embedDescription = doubleGuessers.length
						? 'Well done to those who got it!'
						: 'No one got both song and artist! 🙁 Well done if you got one of them!';
				}
			} else {
				embedDescription = 'Nobody guessed any of it! 🙁 That was a hard one!';
			}

			const [streakLeaderId, streak] = this.streaks.leader ?? [];

			// If there is a streak leader, it must be one of the guessers.
			const streakLeader = streak && doubleGuessers.find((id) => id === streakLeaderId);
			if (streakLeader) {
				embedFooter += ` • ${userMention(streakLeader)} has a streak of ${streak} 🔥`;
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

		await this.messageAllPlayers({ embeds: [embed] });
	}

	public validGuessChannel(channel: TextBasedChannel) {
		return isDMChannel(channel);
	}

	protected calcPointsDivisor(songsListenedTo: number) {
		/*
		In Binb mode the playersScore includes 1st 2nd & 3rd bonuses.
		The following makes the significance of this bonus less with less players
		so that a single player can't farm points in this mode playing by themselves, abusing the 1st place bonus.
		With 1 player the points are equivalent to StandardGame (bonus is offset)
		As the number of players size increases, so does the significance of the bonuses.
		*/
		return songsListenedTo * (1 + 1.5 / this.players.size);
	}

	protected async getPlayers(voiceChannelMembers: Collection<string, GuildMember>) {
		const row = new MessageActionRow() //
			.addComponents(
				new MessageButton() //
					.setCustomId(`${CustomIds.Join}|${voiceChannelMembers.first()!.guild.id}`)
					.setLabel('Join Game')
					.setStyle(Constants.MessageButtonStyles.SUCCESS)
			);

		const embed = createEmbed(`Click the button to join this game of ${this.gameType} music trivia!`);
		const messagePromises = voiceChannelMembers.map((member) => member.send({ embeds: [embed], components: [row] }).catch(() => null));
		await Promise.all(messagePromises);
		await setTimeout(Time.Second * 10);
	}

	protected async sendStartEmbed(embed: MessageEmbed, interaction: CommandInteraction) {
		await interaction.editReply({ embeds: [embed] });
		await this.messageAllPlayers({ embeds: [embed] });
	}

	private async messageAllPlayers(options: string | MessageOptions) {
		await Promise.all(this.players.map((_player, playerID) => container.client.users.send(playerID, options).catch(() => null)));
	}
}
