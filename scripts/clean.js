/**
 * @license Apache License 2.0
 * @copyright 2020 Favware
 * Modified for use in this project.
 */

import { rm } from 'node:fs/promises';

const rootFolder = new URL('../', import.meta.url);
const distFolder = new URL('dist/', rootFolder);

await rm(distFolder, { recursive: true, force: true });
