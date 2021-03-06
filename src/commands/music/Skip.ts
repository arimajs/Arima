import type { CommandOptions } from '@arimajs/discord-akairo';
import type { Message, MessageReaction, User } from 'discord.js-light';
import Command from '../../lib/structures/Command';
import ApplyOptions from '../../lib/utils/ApplyOptions';

@ApplyOptions<CommandOptions>('skip', {
  aliases: ['skip', 's', 'next'],
  description: 'Skip the current song (requires a majority vote)',
  cooldown: 5000,
  game: true,
})
export default class SkipCommand extends Command {
  public async run(message: Message): Promise<void> {
    const { current } = message.guild!.game!;
    if (!current) return message.error("There's no song playing!");

    const members = message.guild!.game!.voice.members.filter(
      (member) => !member.user.bot && member.id !== message.author.id
    );
    let required = Math.ceil(members.size / 2);

    if (required <= 1) return message.guild!.game!.skip();

    const sent = await message.embed(
      `Would you like to skip this song? (1/${required} votes collected)`,
      true
    );

    sent.react('✅');
    const collector = sent.createReactionCollector(
      (reaction: MessageReaction, user: User) =>
        members.keyArray().includes(user.id) && reaction.emoji.name === '✅',
      { max: required, dispose: true }
    );

    message.guild!.game!.connection.dispatcher.on('close', () =>
      collector.stop('nextSong')
    );

    const update = (type: 'add' | 'remove') => {
      sent
        .edit(
          sent.embeds[0].setTitle(
            `Would you like to skip this song? (1/${
              type === 'add' ? --required : ++required
            } votes collected)`
          )
        )
        .catch(() => {});
    };

    collector
      .on('collect', () => update('add'))
      .on('dispose', () => update('remove'))
      .on(
        'end',
        (collected, reason) =>
          reason !== 'nextSong' &&
          current.url === message.guild!.game?.current?.url &&
          message.guild!.game.skip()
      );
  }
}
