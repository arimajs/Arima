import { Constants } from 'discord.js';
import { URL } from 'node:url';

export const rootURL = new URL('../../../', import.meta.url);

export enum BrandingColors {
	Primary = Constants.Colors.AQUA,
	Secondary = Constants.Colors.BLUE
}
