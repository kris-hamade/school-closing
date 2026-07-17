import { json } from '@sveltejs/kit';

export async function GET({ url }) {
	const latitude = Number(url.searchParams.get('lat'));
	const longitude = Number(url.searchParams.get('lon'));

	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
		return json({ error: 'Valid latitude and longitude are required.' }, { status: 400 });
	}

	try {
		const params = new URLSearchParams({
			lat: latitude.toFixed(3),
			lon: longitude.toFixed(3),
			format: 'jsonv2',
			addressdetails: '1',
			zoom: '14'
		});
		const response = await globalThis.fetch(
			`https://nominatim.openstreetmap.org/reverse?${params}`,
			{
				headers: {
					accept: 'application/json',
					'user-agent': 'MichiganSchoolClosures/1.0 (https://misnowday.com)'
				}
			}
		);

		if (!response.ok) throw new Error(`Reverse geocoder returned ${response.status}`);
		const data = await response.json();
		const address = data.address || {};

		return json(
			{
				county: address.county || null,
				city:
					address.city ||
					address.town ||
					address.village ||
					address.municipality ||
					address.hamlet ||
					address.suburb ||
					null,
				state: address.state || null
			},
			{ headers: { 'cache-control': 'private, max-age=3600' } }
		);
	} catch (error) {
		console.error('Location lookup failed:', error);
		return json({ error: 'Location lookup is temporarily unavailable.' }, { status: 503 });
	}
}
