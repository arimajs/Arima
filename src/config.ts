import { cleanEnv, str } from 'envalid';

export const env = cleanEnv(process.env, {
	TOKEN: str({ desc: 'The discord bot token' })
});
