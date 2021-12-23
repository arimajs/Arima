/**
 * @license Apache License 2.0
 * @copyright 2020 Favware
 * Modified for use in this project.
 */

import { fileURLToPath, URL } from 'node:url';
import { opendir } from 'node:fs/promises';
import { join } from 'node:path';
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
	const outdir = fileURLToPath(distFolder);

	await esbuild.build({
		logLevel: 'info',
		entryPoints: tsFiles,
		format: 'esm',
		resolveExtensions: ['.ts', '.js'],
		write: true,
		outdir,
		platform: 'node',
		tsconfig,
		watch,
		incremental: watch,
		sourcemap: true,
		external: [],
		minify: process.env.NODE_ENV === 'production'
	});
}
