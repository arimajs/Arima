import type { PluginBuild } from 'esbuild';
import { defineConfig } from 'tsup';
import { readFile } from 'node:fs/promises';
import typescript from 'typescript';

/**
 * Plugin to reroute all files in the `entities` director to use tsc instead of esbuild.
 * This is needed to preserve metadata in entities for mikro-orm.
 */
const emitDecoratorMetadataPlugin = {
	name: 'emitDecoratorMetadata',
	async setup(build: PluginBuild) {
		const raw = await readFile('./src/tsconfig.json', 'utf8');
		const tsconfig = JSON.parse(raw);

		// The config needs to be parsed to resolve extensions (among other things).
		const parsedTsConfig = typescript.parseJsonConfigFileContent(tsconfig, typescript.sys, './dist');

		// This overwrites the building of all files with a path that matches
		// the regex.
		build.onLoad({ filter: /entities/ }, async (args) => {
			const ts = await readFile(args.path, 'utf8');
			const program = typescript.transpileModule(ts, { compilerOptions: parsedTsConfig.options });
			return { contents: program.outputText };
		});
	}
};

export default defineConfig({
	clean: true,
	dts: false,
	entry: ['src/**/*.ts', '!src/**/*.d.ts'],
	esbuildPlugins: [emitDecoratorMetadataPlugin],
	format: ['esm'],
	minify: false,
	skipNodeModulesBundle: true,
	sourcemap: true,
	target: 'esnext',
	tsconfig: 'src/tsconfig.json',
	bundle: false,
	shims: false,
	keepNames: true,
	splitting: false
});
