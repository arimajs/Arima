/**
 * Shuffles an array in place
 */
export const shuffle = (array: unknown[]) => {
	let m = array.length;
	while (m) {
		const i = Math.floor(Math.random() * m--);
		[array[m], array[i]] = [array[i], array[m]];
	}
};

/**
 * Pluralize `word` if `count` is greater than 1. Does not work with -es plurals.
 * @example pluralize('word', 1) // 'word'
 * @example pluralize('word', 2) // 'words'
 */
export const prefixAndPluralize = (word: string, count: number) => {
	return `${count} ${word}${count === 1 ? '' : 's'}`;
};

const formatter = new Intl.PluralRules('en-US', { type: 'ordinal' });

const suffixes = {
	one: 'st',
	two: 'nd',
	few: 'rd',
	other: 'th'
} as const;

/**
 * Converts a number to its ordinal form.
 * @example ordinal(1) //  => '1st'
 */
export const ordinal = (num: number) => {
	const rule = formatter.select(num) as Exclude<Intl.LDMLPluralRule, 'zero' | 'many'>;
	const suffix = suffixes[rule];
	return `${num}${suffix}`;
};

const medals: Readonly<Record<number, string>> = {
	1: '🥇',
	2: '🥈',
	3: '🥉'
};

/**
 * Converts a rank number to a string to be used for a leaderboard.
 */
export const rankToString = (rank: number) => {
	return medals[rank] ?? `${rank}.`;
};

/**
 * Converts a decimal to a percent.
 */
export const toPercent = (decimal: number) => {
	return `${(decimal * 100).toFixed(2)}%`;
};
