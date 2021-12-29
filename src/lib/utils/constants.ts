import { URL, pathToFileURL } from 'node:url';
import { getRootData } from '@sapphire/pieces';
import { Constants } from 'discord.js';

export const rootURL = new URL('./', pathToFileURL(getRootData().root));

export enum BrandingColors {
	Primary = Constants.Colors.AQUA,
	Secondary = Constants.Colors.BLUE
}
