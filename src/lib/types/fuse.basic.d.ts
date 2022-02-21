// `fuse.basic` essentially removes the ability to parse special query syntax, which is unneeded for our usecase.
// Theoretically this should make searches faster.
declare module 'fuse.js/dist/fuse.basic.min.js' {
	// All types are the same.
	export { default } from 'fuse.js';
}
