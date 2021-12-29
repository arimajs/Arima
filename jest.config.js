/**
 * @type {import('ts-jest').InitialOptionsTsJest}
 */
export default {
	testEnvironment: 'node',
	transform: {
		'^.+\\.tsx?$': 'esbuild-jest'
	}
};
