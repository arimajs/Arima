import { cleanEnv, str } from 'envalid';
import process from 'node:process';

export const env = cleanEnv(process.env, {
	TOKEN: str({ desc: 'The discord bot token' }),
	MONGODB_URI: str({ desc: 'The mongo connection string' })
});
