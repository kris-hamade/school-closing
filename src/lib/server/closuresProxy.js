import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

const PRODUCTION_CLOSURES_URL = 'https://snowday.hamy.app/api/closures';
const DEFAULT_LOCAL_CLOSURES_URL = 'http://127.0.0.1:3023/api/closures';

async function fetchUpstream(url, timeoutMs) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		return await globalThis.fetch(url, {
			headers: { accept: 'application/json' },
			signal: controller.signal
		});
	} finally {
		clearTimeout(timeout);
	}
}

function createProxyResponse(upstream, body, source) {
	return new Response(body, {
		status: upstream.status,
		headers: {
			'content-type': upstream.headers.get('content-type') || 'application/json',
			'cache-control':
				source === 'local'
					? 'no-store'
					: upstream.ok
						? 'public, max-age=30, s-maxage=30, stale-while-revalidate=300'
						: 'no-store',
			'x-closures-upstream': source
		}
	});
}

export async function proxyClosures(path = '') {
	const normalizedPath = path ? `/${path.replace(/^\/+/, '')}` : '';
	const upstreams = [];

	// In development, use the local backend whenever it is reachable. A short
	// timeout keeps the app fast when the backend has not been started yet.
	if (dev) {
		upstreams.push({
			name: 'local',
			baseUrl: env.LOCAL_CLOSURES_API_URL || DEFAULT_LOCAL_CLOSURES_URL,
			timeoutMs: 1200
		});
	}
	upstreams.push({ name: 'production', baseUrl: PRODUCTION_CLOSURES_URL, timeoutMs: 12000 });

	for (const upstreamConfig of upstreams) {
		try {
			const upstream = await fetchUpstream(
				`${upstreamConfig.baseUrl}${normalizedPath}`,
				upstreamConfig.timeoutMs
			);
			const body = await upstream.text();
			return createProxyResponse(upstream, body, upstreamConfig.name);
		} catch (error) {
			if (upstreamConfig.name === 'production') {
				console.error('Production closure API request failed:', error);
			}
		}
	}

	return Response.json(
		{ error: 'The closure service is temporarily unavailable.' },
		{ status: 503, headers: { 'cache-control': 'no-store' } }
	);
}
