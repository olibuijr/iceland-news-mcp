import { env } from '$env/dynamic/private';

export function load() {
	return {
		apiKey: env.GOOGLE_API_KEY || ''
	};
}
