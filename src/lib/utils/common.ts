/**
 * Shuffles an array in place and returns it.
 */
export const shuffle = <T>(array: T[]): T[] => {
	let m = array.length;
	while (m) {
		const i = Math.floor(Math.random() * m--);
		[array[m], array[i]] = [array[i], array[m]];
	}

	return array;
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
