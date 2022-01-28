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
export class UserListener extends Listener<typeof Events.ClientReady> {
	public async run() {
		await this.createAudioNode();

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
  ${magenta('<')}${magentaBright('/')}${magenta('>')} ${bold(`${env.isProduction ? 'PROD' : 'DEV'} MODE`)}
  
${this.storeDebugInformation()}
`
		);
	}

	private async createAudioNode() {
		this.container.games = new Collection();
		this.container.audio = new Node(createAudioOptions(this.client), (guildId, packet) => {
			// https://github.com/skyra-project/audio#usage
			const guild = this.client.guilds.cache.get(guildId);
			return guild?.shard.send(packet);
		});

		// All events from `Node` should be rerouted through `client`. This is a
		// workaround because listeners are registered before `container.audio`
		// is populated, so we can't use it as an emitter.
		this.container.audio.emit = this.client.emit.bind(this.client);

		await this.container.audio.connect();

		// If the bot stayed in a voice channel through a restart, leave.
		for (const guild of this.client.guilds.cache.values()) {
			if (guild.me!.voice.channelId) {
				console.log('testy');
				const player = Queue.getPlayer(guild.id);
				await player.leave();
				await player.stop();
			}
		}
	}

	private storeDebugInformation() {
		const stores = [...this.client.stores.values()];
		const last = stores.pop()!;

		for (const store of stores) {
			this.container.logger.info(this.styleStore(store, false));
		}

		this.container.logger.info(this.styleStore(last, true));
	}

	private styleStore(store: Store<Piece>, last: boolean) {
		return gray(`${last ? '└─' : '├─'} Loaded ${blue(store.size.toString().padEnd(3, ' '))} ${store.name}`);
	}
}
