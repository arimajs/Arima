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
		const raw = await readFile(new URL('./package.json', rootURL), 'utf8');
		const { version } = JSON.parse(raw);

		this.container.logger.info(
			String.raw`

___________                   .__          __           __________        __   
\__    ___/___   _____ ______ |  | _____ _/  |_  ____   \______   \ _____/  |_ 
  |    |_/ __ \ /     \\____ \|  | \__  \\   __\/ __ \   |    |  _//  _ \   __\
  |    |\  ___/|  Y Y  \  |_> >  |__/ __ \|  | \  ___/   |    |   (  <_> )  |  
  |____| \___  >__|_|  /   __/|____(____  /__|  \___  >  |______  /\____/|__|  
             \/      \/|__|             \/          \/          \/             

  ${magenta(version)}
  [${green('+')}] Gateway
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
