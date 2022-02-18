/**
 * @type {import('@swc/core').JscConfig}
 */
const jsc = {
	parser: {
		syntax: 'typescript',
		decorators: true
	},
	transform: {
		legacyDecorator: true,
		decoratorMetadata: true
	},
	keepClassNames: true,
	target: 'es2022'
};

/**
 * @type {import('ts-jest').InitialOptionsTsJest}
 */
export default {
	testEnvironment: 'node',
	extensionsToTreatAsEsm: ['.ts', '.tsx'],
	transform: { '^.+\\.(t|j)sx?$': ['@swc/jest', { jsc }] }
};
