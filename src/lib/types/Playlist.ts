import type { HexColorString } from 'discord.js';
import type { PlaylistType } from '#types/Enums';

export interface BasePlaylist<Type extends PlaylistType, Track> {
	name: string;
	type: Type;
	tracks: Track[];
}

export type LavalinkPlaylist = BasePlaylist<PlaylistType.Lavalink, string>;
export type SpotifyPlaylist = BasePlaylist<PlaylistType.Spotify, { name: string; artist: string }> & { color?: HexColorString; image?: string };
export type Playlist = LavalinkPlaylist | SpotifyPlaylist;
