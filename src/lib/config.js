export const CLOSURES_API_BASE_URL = '/api/closures';

export function getClosuresUrl(path = '') {
	const normalizedPath = path ? `/${path.replace(/^\/+/, '')}` : '';
	return `${CLOSURES_API_BASE_URL}${normalizedPath}`;
}
