import { container, Result, ok, err } from '@sapphire/framework';
import { LoadType, type PlaylistInfo } from '@skyra/audio';
import { getData, type Tracks } from 'spotify-url-info';
import { Time } from '@sapphire/time-utilities';

/**
 * Event types from the Lavalink `event` event we listen too (mouthful)
 */
export enum LavalinkEvent {
	TrackEnd = 'TrackEndEvent',
	TrackStuck = 'TrackStuckEvent',
	TrackException = 'TrackExceptionEvent'
}

/**
 * Capture a random thirty seconds within a duration in seconds to mark the
 * start and end of a track.
 * @param duration The duration of the track in seconds.
 */
export const getRandomThirtySecondWindow = (duration: number) => {
	const start = Math.floor(Math.random() * (duration - 30 * Time.Second));
	return { start, end: start + 30 * Time.Second };
};

interface ResolvedSpotifyData {
	name: string;
	tracks: { items: Tracks[] | { track: Tracks }[] } | Tracks[];
}

/**
 * Resolves scraped Spotify artist, playlist, or album data into the tracks.
 */
const resolveSpotifyTracks = (data: ResolvedSpotifyData) => {
	if ('items' in data.tracks) {
		// Is a playlist.
		if ('track' in data.tracks.items[0]) {
			return data.tracks.items.map((t) => (t as { track: Tracks }).track);
		}

		// Is an album.
		return data.tracks.items as Tracks[];
	}

	// Is an artist.
	return data.tracks;
};

export type Playlist = { name: string } & (
	| {
			type: PlaylistType.Spotify;
			tracks: { name: string; artist: string }[];
	  }
	| {
			type: PlaylistType.Lavalink;
			tracks: string[];
	  }
);

export enum PlaylistType {
	Spotify,
	Lavalink
}

export enum PlaylistResolutionError {
	NotFound,
	NotSuccessful,
	NotPlaylist,
	NotEnoughTracks
}

/**
 * Resolve a Youtube, Bandcamp, Soundcloud, or Spotify playlist from a URL.
 * Also resolves Spotify albums and artists.
 */
export const resolvePlaylist = async (url: string): Promise<Result<Playlist, PlaylistResolutionError>> => {
	try {
		// spotify-url-info validates URLs via spotify-uri, and will immediately
		// throw an error if it's not valid.
		const spotifyData: ResolvedSpotifyData = await getData(url);

		// If there's no `tracks` property, it's a track or podcast
		if (!spotifyData.tracks) {
			return err(PlaylistResolutionError.NotPlaylist);
		}

		const tracks = resolveSpotifyTracks(spotifyData);

		const filteredTracks = tracks.filter(({ duration_ms }) => duration_ms * Time.Second > 30);
		if (filteredTracks.length < 5) {
			return err(PlaylistResolutionError.NotEnoughTracks);
		}

		return ok({
			type: PlaylistType.Spotify,
			name: spotifyData.name,
			tracks: filteredTracks.map((track) => ({ name: track.name, artist: track.artists![0].name }))
		});
	} catch {
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
	}
};
