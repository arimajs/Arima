/**
 * @license Apache License 2.0
 * @copyright 2020 Favware
 * Modified for use in this project.
 */

/* eslint-disable @typescript-eslint/unbound-method */
import { fileURLToPath, URL } from 'node:url';
import { opendir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import typescript from 'typescript';
import esbuild from 'esbuild';

async function* scan(path, cb) {
	const dir = await opendir(path);

	for await (const item of dir) {
		const file = join(dir.path, item.name);
		if (item.isFile()) {
			if (cb(file)) {
				yield file;
			}
		} else if (item.isDirectory()) {
			yield* scan(file, cb);
		}
	}
}

export async function build(watch = false) {
	const rootFolder = new URL('../', import.meta.url);
	const distFolder = new URL('dist/', rootFolder);
	const srcFolder = new URL('src/', rootFolder);

	const tsFiles = [];
	const fileRegex = /(?<!\.d)\.ts/;

	for await (const path of scan(srcFolder, (file) => fileRegex.test(file))) {
		tsFiles.push(path);
	}

	const tsconfig = join(fileURLToPath(srcFolder), 'tsconfig.json');
	const outDir = fileURLToPath(distFolder);

	await esbuild.build({
		logLevel: 'info',
		entryPoints: tsFiles,
		format: 'esm',
		resolveExtensions: ['.ts', '.js'],
		write: true,
		outdir: outDir,
		platform: 'node',
		plugins: [{ name: 'tsc', setup: await pluginTsc(tsconfig, outDir) }],
		tsconfig,
		watch,
		incremental: watch,
		sourcemap: true,
		external: [],
		minify: process.env.NODE_ENV === 'production'
	});
}

/**
 * Plugin to reroute all files in the `entities` director to use tsc instead of esbuild.
 * This is needed to preserve metadata in entities for mikro-orm.
 * @param {string} tsconfigPath
 * @param {string} outDir
 */
async function pluginTsc(tsconfigPath, outDir) {
	const raw = await readFile(tsconfigPath, 'utf8');
	const tsconfig = JSON.parse(raw);

	// The config needs to be parsed to resolve extensions (among other things).
	const parsedTsConfig = typescript.parseJsonConfigFileContent(tsconfig, typescript.sys, outDir);

	/**
	 * @param {esbuild.PluginBuild} build
	 */
	return function setup(build) {
		// This overwrites the building of all files with a path that matches the regex.
		build.onLoad({ filter: /entities/ }, async (args) => {
			const ts = await readFile(args.path, 'utf8');
			const program = typescript.transpileModule(ts, { compilerOptions: parsedTsConfig.options });
			return { contents: program.outputText };
		});
	};
}
