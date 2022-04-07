import type { ResolvedSpotifyData, SpotifyTrack, Playlist, ExtendedTrack, SpotifyImage } from '#types/Playlist';
import { container, isOk, ok, err, fromAsync, type Result } from '@sapphire/framework';
import { LoadType, type PlaylistInfo } from '@skyra/audio';
import { PlaylistResolutionError, PlaylistType } from '#types/Enums';
import { wordSimilarityThreshold } from '#utils/constants';
import { jaroWinkler } from '@skyra/jaro-winkler';
import { parseURL } from '@sapphire/utilities';
import { fetch } from 'undici';
import { Time } from '@sapphire/time-utilities';
import { URL } from 'node:url';
import init from 'spotify-url-info';

// eslint-disable-next-line @typescript-eslint/unbound-method
export const { getData: getSpotifyData } = init(fetch);

/**
 * Capture a random thirty seconds within a duration in seconds to mark the
 * start and end of a track.
 * @param duration The duration of the track in seconds.
 */
export const getRandomThirtySecondWindow = (duration: number) => {
	const start = Math.floor(Math.random() * (duration - 30 * Time.Second));
	return { start, end: start + 30 * Time.Second };
};

/**
 * A typeguard that guarrantees that {@link ResolvedSpotifyData} is a playlist by checking if a property exists on its items.
 */
export const isPlaylist = (items: SpotifyTrack[] | { track: SpotifyTrack }[]): items is { track: SpotifyTrack }[] => {
	return 'track' in items[0];
};

/**
 * Resolves scraped Spotify artist, playlist, or album data into the tracks.
 */
const resolveSpotifyTracks = (data: ResolvedSpotifyData) => {
	if ('items' in data.tracks) {
		if (isPlaylist(data.tracks.items)) {
			return data.tracks.items.map(({ track }) => track);
		}

		// Is an album.
		return data.tracks.items;
	}

	// Is an artist.
	return data.tracks;
};

/**
 * Resolve a playlist/album/artist from a URL.
 */
export const resolvePlaylist = async (url: string): Promise<Result<Playlist, PlaylistResolutionError>> => {
	const isValidURL = Boolean(parseURL(url));
	if (!isValidURL) {
		return err(PlaylistResolutionError.NotFound);
	}

	const res = await fromAsync(() => getSpotifyData(url));
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

	const filteredTracks = tracks.filter(({ duration_ms }) => duration_ms / Time.Second > 30);
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

	const filteredTracks = response.tracks.filter(({ info }) => info.length / Time.Second > 30);
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
export const resolveThumbnail = (info: ExtendedTrack['info']) => {
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
export const getBiggestImage = (images: SpotifyImage[]) => {
	// Array#reduce is actually more performant than #sort in this situation.
	// eslint-disable-next-line unicorn/no-array-reduce
	return images.reduce((a, b) => (a.width > b.width ? a : b)).url;
};

/**
 * Generate 3 variations of the song name: Stripped prefix, stripped suffix, stripped both.
 */
export const cleanSongName = (songName: string, artistNames: string[]) => {
	const normalized = convertToNormalized(songName);

	// "Blank Space - Taylor Swift" -> "Blank Space"
	// "Blank Space (Lyric Video)" -> "Blank Space"
	const songWithoutSuffix = normalized.replace(/\s*\(.*|\s*- .*/, '');

	// "Taylor Swift  -  Blank Space" -> "Blank Space"
	const songWithoutPrefix = normalized.replace(/.* -\s*/, '');

	// Applies both of the above, one at a time.
	// "Taylor Swift - Blank Space (Lyrics Video)" -> "Blank Space"
	let songWithoutSuffixAndPrefix = normalized;
	songWithoutSuffixAndPrefix = songWithoutSuffixAndPrefix.replace(/.* -\s*/, '');
	songWithoutSuffixAndPrefix = songWithoutSuffixAndPrefix.replace(/\s*\(.*|\s*- .*/, '');

	// Remove any strings that contain an artist as this isn't the song name.
	const songNamesNoArtist = [songWithoutSuffixAndPrefix, songWithoutPrefix, songWithoutSuffix].filter(
		(songName) => !artistNames.some((artist) => jaroWinkler(songName, artist) >= wordSimilarityThreshold)
	);

	return [...new Set([...songNamesNoArtist, normalized].map((variation) => convertToAlphaNumeric(variation)))];
};

/**
 * Currently just does suffix removal, but this is not safe at all.
 */
export const cleanArtistName = (artistName: string) => {
	const normalized = convertToNormalized(artistName);
	const artistWithoutSuffix = normalized.replace(/\s*\(.*|\s*- .*|VEVO$/, '');
	return convertToAlphaNumeric(artistWithoutSuffix);
};

/**
 * Remove all characters that aren't letters or numbers from a string in any language.
 * @example convertToAlphaNumeric('A ticket to 大阪 costs ¥2000 👌.'); // Aticketto大阪costs2000
 */
export const convertToAlphaNumeric = (str: string) => {
	// https://unicode.org/reports/tr18/#General_Category_Property
	return str.replace(/[^\p{L}\p{N}]/gu, '');
};

/**
 * Converts a string to lowercase and normalizes it using the NFKD Unicode Normalization Form.
 * @example convertToNormalized('ａｂｃＡＢＣ'); // abcabc
 */
export const convertToNormalized = (str: string) => {
	return str.normalize('NFKD').toLowerCase();
};

/**
 * Combination of {@link convertToAlphaNumeric} and {@link convertToNormalized}.
 */
export const cleanName = (str: string) => {
	return convertToAlphaNumeric(convertToNormalized(str));
};
