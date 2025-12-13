import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import dotenv from 'dotenv';

dotenv.config(); // Load variables from .env

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		host: true // Ensures the server listens on external IPs if needed
	}
});
