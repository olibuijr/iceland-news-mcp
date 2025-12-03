import { sveltekit } from '@sveltejs/kit/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit(), basicSsl()],
	envDir: '..',
	server: {
		host: '0.0.0.0',
		allowedHosts: ['titan', 'localhost', 'icelandic-news-mcp.olibuijr.com']
	},
	preview: {
		host: '0.0.0.0',
		allowedHosts: ['titan', 'localhost', 'icelandic-news-mcp.olibuijr.com']
	}
});
