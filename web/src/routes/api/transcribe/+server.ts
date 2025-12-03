import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const WHISPER_SERVICE_URL = 'http://192.168.8.191:7050';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();

		const response = await fetch(`${WHISPER_SERVICE_URL}/transcribe/pcm`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			const errorText = await response.text();
			return json(
				{ error: `Whisper service error: ${response.status}`, details: errorText },
				{ status: response.status }
			);
		}

		const result = await response.json();
		return json(result);
	} catch (error) {
		console.error('Transcription proxy error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
