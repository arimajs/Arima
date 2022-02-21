import type { HexColorString } from 'discord.js';
import { container, isOk, ok, err, fromAsync, type Result } from '@sapphire/framework';
import { LoadType, type TrackInfo, type PlaylistInfo } from '@skyra/audio';
import { getData as getSpotifyData, type Tracks } from 'spotify-url-info';
import { PlaylistResolutionError, PlaylistType } from '../types/Enums';
import { parseURL } from '@sapphire/utilities';
import { Time } from '@sapphire/time-utilities';
import { URL } from 'node:url';

/**
 * Capture a random thirty seconds within a duration in seconds to mark the
 * start and end of a track.
 * @param duration The duration of the track in seconds.
 */
export const getRandomThirtySecondWindow = (duration: number) => {
	const start = Math.floor(Math.random() * (duration - 30 * Time.Second));
	return { start, end: start + 30 * Time.Second };
};

export interface SpotifyAdditions {
	color?: HexColorString;
	image?: string;
}

export interface SpotifyImage {
	url: string;
	width: number;
}

export interface ExtendedTrack extends Tracks {
	album: { images: SpotifyImage[] };
	dominantColor: HexColorString;
}

export interface ResolvedSpotifyData {
	name: string;
	dominantColor: HexColorString;
	images: SpotifyImage[];
	tracks: { items: ExtendedTrack[] | { track: ExtendedTrack }[] } | ExtendedTrack[];
}

/**
 * Resolves scraped Spotify artist, playlist, or album data into the tracks.
 */
const resolveSpotifyTracks = (data: ResolvedSpotifyData) => {
	if ('items' in data.tracks) {
		// Is a playlist.
		if ('track' in data.tracks.items[0]) {
			return data.tracks.items.map((t) => (t as { track: ExtendedTrack }).track);
		}

		// Is an album.
		return data.tracks.items as ExtendedTrack[];
	}

	// Is an artist.
	return data.tracks;
};

export type Playlist = { name: string } & (
	| { type: PlaylistType.Lavalink; tracks: string[] }
	| ({ type: PlaylistType.Spotify; tracks: ({ name: string; artist: string } & SpotifyAdditions)[] } & SpotifyAdditions)
);

/**
 * Resolve a playlist/album/artist from a URL.
 */
export const resolvePlaylist = async (url: string): Promise<Result<Playlist, PlaylistResolutionError>> => {
	const isValidURL = Boolean(parseURL(url));
	if (!isValidURL) {
		return err(PlaylistResolutionError.NotFound);
	}

	const res = await fromAsync<ResolvedSpotifyData>(() => getSpotifyData(url));
	if (isOk(res)) {
		return resolveSpotifyEntity(res.value);
	}

	return resolveLavalinkURL(url);
};

/**
 * Resolved a playlist/album/artist from scraped Spotify data.
 */
export const resolveSpotifyEntity = (data: ResolvedSpotifyData): Result<Playlist, PlaylistResolutionError> => {
	// If there's no `tracks` property, it's a track or podcast
	if (!data.tracks) {
		return err(PlaylistResolutionError.NotPlaylist);
	}

	const tracks = resolveSpotifyTracks(data);

	const filteredTracks = tracks.filter(({ duration_ms }) => duration_ms * Time.Second > 30);
	if (filteredTracks.length < 5) {
		return err(PlaylistResolutionError.NotEnoughTracks);
	}

	return ok({
		type: PlaylistType.Spotify,
		name: data.name,
		color: data.dominantColor,
		image: getBiggestImage(data.images),
		tracks: filteredTracks.map((track) => ({
			name: track.name,
			artist: track.artists![0].name,
			color: track.dominantColor,
			image: getBiggestImage(track.album.images)
		}))
	});
};

/**
 * Resolves a playlist from a URL through Lavalink.
 */
export const resolveLavalinkURL = async (url: string): Promise<Result<Playlist, PlaylistResolutionError>> => {
	const response = await container.audio.load(url);
	if (response.loadType === LoadType.NoMatches) {
		return err(PlaylistResolutionError.NotFound);
	}

	if (response.loadType === LoadType.LoadFailed) {
		return err(PlaylistResolutionError.NotSuccessful);
	}

	if (response.loadType !== LoadType.PlaylistLoaded) {
		return err(PlaylistResolutionError.NotPlaylist);
	}

	const filteredTracks = response.tracks.filter(({ info }) => info.length * Time.Second > 30);
	if (filteredTracks.length < 5) {
		return err(PlaylistResolutionError.NotEnoughTracks);
	}

	return ok({
		type: PlaylistType.Lavalink,
		name: (response.playlistInfo as PlaylistInfo).name,
		tracks: filteredTracks.map(({ track }) => track)
	});
};

/**
 * Resolve thumbnail from a Youtube or Spotify entity.
 */
export const resolveThumbnail = (info: TrackInfo & SpotifyAdditions) => {
	if (info.image) {
		return info.image;
	}

	const url = new URL(info.uri);
	if (url.hostname === 'www.youtube.com') {
		return `https://img.youtube.com/vi/${info.identifier}/mqdefault.jpg`;
	}

	return null;
};

/**
 * Get the biggest image in an array of {@link SpotifyImage}s.
 */
export const getBiggestImage = (images: SpotifyImage[]): string => {
	// Array#reduce is actually more performant than #sort in this situation.
	// eslint-disable-next-line unicorn/no-array-reduce
	return images.reduce((a, b) => (a > b ? a : b)).url;
};

/**
 * Generate 3 variations of the song name: Stripped prefix, stripped suffix, stripped both.
 */
export const cleanSongName = (songName: string): string[] => {
	songName = songName.toLowerCase();

	// "Blank Space - Taylor Swift" -> "Blank Space"
	// "Blank Space (Lyric Video)" -> "Blank Space"
	const songWithoutSuffix = songName.replace(/\s*\(.*|\s*- .*/, '');

	// "Taylor Swift  -  Blank Space" -> "Blank Space"
	const songWithoutPrefix = songName.replace(/.* -\s*/, '');

	// Applies both of the above, one at a time.
	// "Taylor Swift - Blank Space (Lyrics Video)" -> "Blank Space"
	let songWithoutSuffixAndPrefix = songName;
	songWithoutSuffixAndPrefix = songWithoutSuffixAndPrefix.replace(/.* -\s*/, '');
	songWithoutSuffixAndPrefix = songWithoutSuffixAndPrefix.replace(/\s*\(.*|\s*- .*/, '');

	// Try a bunch of different variations to try to match the most accurate track name.
	const validSongVariations = [...[songWithoutSuffixAndPrefix, songWithoutPrefix, songWithoutSuffix].filter((str) => str !== songName), songName];

	// Remove all characters that aren't letters or numbers from all variations. It's drastic, but highly increases accuracy.
	return validSongVariations.map((variation) => variation.replace(/[^\p{L}\p{N}]/gu, ''));
};

// Not sure what kind of regex is appropriate for cleaning artist names yet.
export const cleanArtistName = (artistName: string) => {
	return artistName.toLowerCase();
};
