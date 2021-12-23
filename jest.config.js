/**
 * @type {import('ts-jest/dist/types').InitialOptionsTsJest}
 */
const config = {
	testEnvironment: 'node',
	transform: {
		'^.+\\.tsx?$': 'esbuild-jest'
	}
};

export default config;
