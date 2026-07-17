import { proxyClosures } from '$lib/server/closuresProxy.js';

export function GET({ params }) {
	return proxyClosures(`school/${encodeURIComponent(params.query)}`);
}
