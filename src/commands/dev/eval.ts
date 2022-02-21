import { BrandingColor } from '#types/Enums';
import { ArimaCommand } from '#structures/ArimaCommand';
import { createEmbed } from '#utils/responses';
import { isThenable } from '@sapphire/utilities';
import { Stopwatch } from '@sapphire/stopwatch';
import { codeBlock } from '@discordjs/builders';
import { inspect } from 'node:util';
import { Buffer } from 'node:buffer';
import { Type } from '@sapphire/type';
import { env } from '#root/config';

// In the future, this may be converted to/accompanied with a context menu
// interaction. That way, users could naturally send multiline code. Or, modals
// could be used instead (when they're released).
export class UserCommand extends ArimaCommand {
	public override async chatInputRun(interaction: ArimaCommand.Interaction) {
		const code = interaction.options.getString('code', true);
		const depth = interaction.options.getInteger('depth');
		const isAsync = interaction.options.getBoolean('async');
		const ephemeral = interaction.options.getBoolean('ephemeral') ?? false;

		await interaction.deferReply({ ephemeral });

		const { result, success, type, elapsed } = await this.eval(interaction, code, { isAsync, depth });
		const output = success ? codeBlock('js', result) : codeBlock('bash', result);

		const embedLimitReached = output.length > 4096;
		const embed = createEmbed(
			embedLimitReached ? 'Output was too long! The result has been sent as a file.' : output,
			success ? BrandingColor.Primary : BrandingColor.Error
		);

		embed
			.setTitle(success ? 'Eval Result ✨' : 'Eval Error 💀')
			.addField('Type 📝', codeBlock('ts', type), true)
			.addField('Elapsed ⏱', elapsed, true);

		const files = embedLimitReached ? [{ attachment: Buffer.from(output), name: 'output.txt' }] : [];
		await interaction.editReply({ embeds: [embed], files });
	}

	public override registerApplicationCommands(registry: ArimaCommand.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName(this.name)
					.setDescription('[owner only] Evaluate any JavaScript code!')
					.addStringOption((builder) =>
						builder //
							.setName('code')
							.setDescription('The code to evaluate')
							.setRequired(true)
					)
					.addBooleanOption((builder) =>
						builder
							.setName('async')
							.setDescription('Whether to allow use of async/await. If set, the result will have to be returned')
							.setRequired(false)
					)
					.addBooleanOption((builder) =>
						builder //
							.setName('ephemeral')
							.setDescription('Whether to show the result ephemerally')
							.setRequired(false)
					)
					.addIntegerOption((builder) =>
						builder //
							.setName('depth')
							.setDescription('The depth of the displayed return type')
							.setRequired(false)
					),
			{ idHints: ['937413389221789766'], guildIds: [env.DEV_SERVER_ID] }
		);
	}

	private async eval(interaction: ArimaCommand.Interaction, code: string, { isAsync, depth }: { isAsync: boolean | null; depth: number | null }) {
		if (isAsync) {
			code = `(async () => {\n${code}\n})();`;
		}

		let success = true;
		let result;

		const stopwatch = new Stopwatch();
		let elapsed = '';

		try {
			// This will serve as an alias for ease of use in the eval code
			// @ts-expect-error 6133
			const i = interaction;

			// eslint-disable-next-line no-eval
			result = eval(code);
			elapsed = stopwatch.toString();

			if (isThenable(result)) {
				stopwatch.restart();
				result = await result;
				elapsed = stopwatch.toString();
			}
		} catch (error) {
			if (!elapsed) {
				elapsed = stopwatch.toString();
			}

			result = (error as Error).message ?? error;
			success = false;
		}

		stopwatch.stop();

		const type = new Type(result).toString();

		if (typeof result !== 'string') {
			result = inspect(result, { depth });
		}

		return { result, success, type, elapsed };
	}
}
