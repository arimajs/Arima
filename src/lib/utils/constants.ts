import { pathToFileURL } from 'node:url';
import { getRootData } from '@sapphire/pieces';

export const rootURL = pathToFileURL(`${getRootData().root}/`);
