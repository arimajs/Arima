import type { Piece, Store } from '@sapphire/framework';
import { blue, gray, green, magenta, magentaBright, bold } from 'colorette';
import { Listener, Events } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { readFile } from 'node:fs/promises';
import { rootURL } from '#utils/constants';
import { env } from '#root/config';
import { URL } from 'node:url';

@ApplyOptions<Listener.Options>({ once: true })
export class UserEvent extends Listener<typeof Events.ClientReady> {
	public async run() {
		const raw = await readFile(new URL('../package.json', rootURL), 'utf8');
		const { version } = JSON.parse(raw);

		this.container.logger.info(
			String.raw`
                       .__                
╔═══╗     _____ _______|__| _____ _____
║(●)║♫    \__  \\_  __ \  |/     \\__  \
║███║ ♫    / __ \|  | \/  |  Y Y  \/ __ \_
║(●)║♫    (____  /__|  |__|__|_|  (____  /
╚═══╝ ♪        \/               \/     \/			

  ${magenta(version)}
  [${green('+')}] Gateway
  [${green('+')}] Database
  ${magenta('<')}${magentaBright('/')}${magenta('>')} ${bold(`${env.isProduction ? 'DEV' : 'PROD'} MODE`)}
  
${this.storeDebugInformation()}
`
		);
	}

	private storeDebugInformation() {
		const stores = [...this.container.client.stores.values()];
		return stores //
			.reverse()
			.reduce((list, store) => `${this.styleStore(store, false)}\n${list}`, this.styleStore(stores.pop()!, true));
	}

	private styleStore(store: Store<Piece>, last: boolean) {
		return gray(`${last ? '└─' : '├─'} Loaded ${blue(store.size.toString().padEnd(3, ' '))} ${store.name}`);
	}
}
