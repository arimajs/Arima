import { pathToFileURL } from 'node:url';
import { getRootData } from '@sapphire/pieces';

export const rootURL = pathToFileURL(`${getRootData().root}/`);

// Might be changed in the future after more testing.
export const kGuessThreshold = 0.9 as const;
