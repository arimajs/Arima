import { blue, gray, green, magenta, magentaBright, bold } from 'colorette';
import { Listener, Events, type Piece, type Store } from '@sapphire/framework';
import { createAudioOptions, env } from '#root/config';
import { ApplyOptions } from '@sapphire/decorators';
import { Collection } from 'discord.js';
import { readFile } from 'node:fs/promises';
import { rootURL } from '#utils/constants';
import { Queue } from '#game/Queue';
import { Node } from '@skyra/audio';
import { URL } from 'node:url';

@ApplyOptions<Listener.Options>({ once: true })
export class UserEvent extends Listener<typeof Events.ClientReady> {
	public async run() {
		await this.createQueueClient();

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
  [${green('+')}] Audio
  ${magenta('<')}${magentaBright('/')}${magenta('>')} ${bold(`${env.isProduction ? 'DEV' : 'PROD'} MODE`)}
  
${this.storeDebugInformation()}
`
		);
	}

	private async createQueueClient() {
		this.container.games = new Collection();
		this.container.audio = new Node(createAudioOptions(this.container.client), (guildId, packet) => {
			// https://github.com/skyra-project/audio#usage
			const guild = this.container.client.guilds.cache.get(guildId);
			return guild?.shard.send(packet);
		});

		// If the bot stayed in a voice channel through a restart, leave.
		for (const guild of this.container.client.guilds.cache.values()) {
			if (guild.me!.voice.channelId) {
				await Queue.getPlayer(guild.id).leave();
			}
		}
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
