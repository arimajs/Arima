import type {
  CommandOptions,
  PromptContentSupplier,
} from '@arimajs/discord-akairo';
import type { Message } from 'discord.js-light';
import { DocumentType } from '@typegoose/typegoose';
import Command from '../../lib/structures/Command';
import ApplyOptions from '../../lib/utils/ApplyOptions';
import type { Playlist } from '../../lib/database/entities';

interface Args {
  playlist: DocumentType<Playlist>;
  newPlaylist: DocumentType<Playlist> | Playlist;
}

@ApplyOptions<CommandOptions>('add-songs', {
  aliases: ['add-songs', 'save-songs'],
  description:
    'Add a playlist of songs to your custom playlist (`a!create-playlist`)',
  usage: '<name> <playlist>',
  examples: ['Top 100 Songs Weekly', 'spotify:playlist:10J2w5eBSQcBtiRB89V5bU'],
  cooldown: 5000,
  args: [
    {
      id: 'playlist',
      type: 'custom-playlist',
      description: 'The custom playlist to add to',
      prompt: {
        start: 'What playlist would you like to add to?',
        retry: 'Please provide the name of one of your custom playlists',
      },
    },
    {
      id: 'newPlaylist',
      type: 'playlist',
      description:
        'Playlist to add (custom, soundcloud, spotify, and youtube links and keywords accepted)',
      prompt: {
        start: 'What playlist would you like to add?',
        retry: ((message, { failure }: { failure: { value: string } }) =>
          message
            .embed(
              `${
                failure.value === 'NO_TRACKS'
                  ? "There's no tracks on that playlist!"
                  : "I couldn't find any playlists!"
              } Please try again`
            )
            .setFooter('Respond with `cancel` to cancel')
            .setColor('RED')) as PromptContentSupplier,
      },
    },
  ],
  clientPermissions: ['ADD_REACTIONS', 'READ_MESSAGE_HISTORY'],
})
export default class AddSongCommand extends Command {
  public async run(
    message: Message,
    { playlist, newPlaylist }: Args
  ): Promise<unknown> {
    // TODO only x amount of songs unless you support on patreon
    if (newPlaylist.tracks.some((song) => song.duration < 3e4)) {
      await message.embed(
        'Filtering out songs with a duration of less than 30 seconds...',
        true
      );
      newPlaylist.tracks = newPlaylist.tracks.filter(
        (song) => song.duration > 3e4
      );

      if (!newPlaylist.tracks.length)
        return message.error(
          'There are no songs on the playlist less than 30 seconds long'
        );
    }

    if (
      newPlaylist.tracks.some(({ url }) =>
        playlist.tracks.some((track) => track.url === url)
      )
    ) {
      await message.embed(
        'Filtering out songs you already have on your playlist...',
        true
      );

      newPlaylist.tracks = newPlaylist.tracks.filter(
        ({ url }) => !playlist.tracks.some((track) => track.url === url)
      );

      if (!newPlaylist.tracks.length)
        return message.error(
          "There are no songs songs on the playlist you don't already have"
        );
    }

    playlist.track_count += newPlaylist.track_count;

    const color = await Promise.race([
      newPlaylist.color,
      [52, 152, 219] as [number, number, number],
    ]);
    message.embed(
      `All songs from "${newPlaylist.title}" by ${
        newPlaylist!.author
      } have been merged!`,
      (embed) =>
        embed
          .setColor(color)
          .setThumbnail(newPlaylist.thumbnail)
          .setDescription(
            `You now have ${playlist.track_count} songs on your playlist "${playlist.title}"`
          )
          .setURL(newPlaylist!.url || '')
    );

    playlist.tracks.push(
      ...(await Promise.all(
        newPlaylist.tracks.map(async (track) => ({
          ...track,
          color: await track.color,
        }))
      ))
    );
    playlist.save();
  }
}
