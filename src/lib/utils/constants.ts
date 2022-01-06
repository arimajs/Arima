import { pathToFileURL } from 'node:url';
import { getRootData } from '@sapphire/pieces';
import { Constants } from 'discord.js';

export const rootURL = pathToFileURL(`${getRootData().root}/`);

export enum BrandingColors {
	Primary = Constants.Colors.AQUA,
	Secondary = Constants.Colors.BLUE,
	Error = Constants.Colors.RED
}
