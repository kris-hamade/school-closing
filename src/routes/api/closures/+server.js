import { proxyClosures } from '$lib/server/closuresProxy.js';

export function GET() {
	return proxyClosures();
}
