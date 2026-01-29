/**
 * Shuffles an array in place.
 */
export const shuffle = (array: unknown[]) => {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
};

/**
 * Pluralize `word` if `count` is greater than 1. For other basic suffixes, use the third parameter, suffix.
 * @example pluralize('word', 1) // 'word'
 * @example pluralize('word', 2) // 'words'
 */
export const pluralize = (word: string, count: number, suffix = 's') => {
	return `${count} ${word}${count === 1 ? '' : suffix}`;
};

const formatter = new Intl.PluralRules('en-US', { type: 'ordinal' });

const suffixes = {
	one: 'st',
	two: 'nd',
	few: 'rd',
	other: 'th'
} as Record<Intl.LDMLPluralRule, string>;

/**
 * Converts a number to its ordinal form.
 * @example ordinal(1) //  => '1st'
 */
export const ordinal = (num: number) => {
	const rule = formatter.select(num);
	const suffix = suffixes[rule];
	return `${num}${suffix}`;
};

const medals = ['🥇', '🥈', '🥉'] as const;

/**
 * Converts a rank index to a string to be used for a leaderboard.
 */
export const rankToString = (rank: number) => {
	return medals[rank] ?? `${rank + 1}.`;
};

/**
 * Converts a decimal to a percent.
 */
export const toPercent = (decimal: number) => {
	return `${(decimal * 100).toFixed(2)}%`;
};
