import { cleanEnv, str } from 'envalid';
import { env } from 'node:process';

export const config = cleanEnv(env, {
	TOKEN: str({ desc: 'The discord bot token' }),
	MONGODB_URI: str({ desc: 'The mongo connection string' })
});
