import type { Track, TrackInfo } from '@skyra/audio';
import type { HexColorString } from 'discord.js';
import type { PlaylistType } from '#types/Enums';
import type { Tracks } from 'spotify-url-info';

/**
 * Extra track & playlist data that is only available when using Spotify as a provider.
 */
export interface SpotifyAdditions {
	color?: HexColorString;
	image?: string;
}

export interface SpotifyImage {
	url: string;
	width: number;
}

export interface SpotifyTrack extends Tracks {
	album: { images: SpotifyImage[] };
	dominantColor: HexColorString;
}

/**
 * Data received from scraping Spotify.
 */
export interface ResolvedSpotifyData {
	name: string;
	dominantColor: HexColorString;
	images: SpotifyImage[];
	// Due to the often messy nature of scraped data, `tracks` could be in many different formats depending on the
	// Spotify entity type.
	tracks: { items: SpotifyTrack[] | { track: SpotifyTrack }[] } | SpotifyTrack[];
}

export interface BasePlaylist<Type extends PlaylistType, Track> {
	name: string;
	type: Type;
	tracks: Track[];
}

export type LavalinkPlaylist = BasePlaylist<PlaylistType.Lavalink, string>;
export type SpotifyPlaylist = BasePlaylist<PlaylistType.Spotify, { name: string; artist: string } & SpotifyAdditions> & SpotifyAdditions;
export type Playlist = LavalinkPlaylist | SpotifyPlaylist;

export interface ExtendedTrack extends Track {
	info: TrackInfo & SpotifyAdditions;
}
