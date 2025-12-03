import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GOOGLE_API_KEY } from '$env/static/private';

export const GET: RequestHandler = async () => {
	if (!GOOGLE_API_KEY) {
		return json({ error: 'Google API key not configured' }, { status: 500 });
	}

	return json({ apiKey: GOOGLE_API_KEY });
};
