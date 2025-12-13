<script>
	import { onMount } from 'svelte';

	const STORAGE_ENABLED_KEY = 'weatherWidget.enabled';
	const STORAGE_COORDS_KEY = 'weatherWidget.coords';

	const GEO_OPTIONS = {
		enableHighAccuracy: false,
		timeout: 10_000,
		maximumAge: 5 * 60_000
	};

	let hasGeolocation = false;
	let status = 'idle'; // idle | loading | ready | error
	let errorMessage = null;

	let coords = null; // { latitude, longitude }
	let place = null; // { name, admin1, country_code }
	let weather = null; // { temperature_2m, apparent_temperature, wind_speed_10m, weather_code, time }

	let temperatureUnit = '°F';
	let windUnit = 'mph';

	function isEnabled() {
		try {
			return localStorage.getItem(STORAGE_ENABLED_KEY) === '1';
		} catch {
			return false;
		}
	}

	function setEnabled(enabled) {
		try {
			localStorage.setItem(STORAGE_ENABLED_KEY, enabled ? '1' : '0');
		} catch {
			// ignore
		}
	}

	function loadStoredCoords() {
		try {
			const raw = localStorage.getItem(STORAGE_COORDS_KEY);
			if (!raw) return null;
			const parsed = JSON.parse(raw);
			if (
				!parsed ||
				typeof parsed.latitude !== 'number' ||
				typeof parsed.longitude !== 'number' ||
				Number.isNaN(parsed.latitude) ||
				Number.isNaN(parsed.longitude)
			) {
				return null;
			}
			return { latitude: parsed.latitude, longitude: parsed.longitude };
		} catch {
			return null;
		}
	}

	function storeCoords(nextCoords) {
		try {
			localStorage.setItem(STORAGE_COORDS_KEY, JSON.stringify(nextCoords));
		} catch {
			// ignore
		}
	}

	function formatPlace(p, c) {
		if (p?.name) {
			const parts = [p.name];
			if (p.admin1) parts.push(p.admin1);
			return parts.join(', ');
		}
		if (c) return `${c.latitude.toFixed(2)}, ${c.longitude.toFixed(2)}`;
		return 'Your location';
	}

	function wmoLabel(code) {
		// https://open-meteo.com/en/docs#weathervariables
		if (code === 0) return 'Clear';
		if (code === 1 || code === 2) return 'Partly cloudy';
		if (code === 3) return 'Overcast';
		if (code === 45 || code === 48) return 'Fog';
		if (code === 51 || code === 53 || code === 55) return 'Drizzle';
		if (code === 56 || code === 57) return 'Freezing drizzle';
		if (code === 61 || code === 63 || code === 65) return 'Rain';
		if (code === 66 || code === 67) return 'Freezing rain';
		if (code === 71 || code === 73 || code === 75) return 'Snow';
		if (code === 77) return 'Snow grains';
		if (code === 80 || code === 81 || code === 82) return 'Rain showers';
		if (code === 85 || code === 86) return 'Snow showers';
		if (code === 95) return 'Thunderstorm';
		if (code === 96 || code === 99) return 'Thunderstorm w/ hail';
		return 'Weather';
	}

	function getCurrentPosition() {
		return new Promise((resolve, reject) => {
			navigator.geolocation.getCurrentPosition(resolve, reject, GEO_OPTIONS);
		});
	}

	async function fetchPlace(latitude, longitude) {
		const url = new URL('https://geocoding-api.open-meteo.com/v1/reverse');
		url.searchParams.set('latitude', String(latitude));
		url.searchParams.set('longitude', String(longitude));
		url.searchParams.set('count', '1');
		url.searchParams.set('language', 'en');
		url.searchParams.set('format', 'json');

		const res = await fetch(url);
		if (!res.ok) throw new Error('Failed to reverse-geocode location');
		const data = await res.json();
		const first = data?.results?.[0];
		if (!first) return null;
		return {
			name: first.name ?? null,
			admin1: first.admin1 ?? null,
			country_code: first.country_code ?? null
		};
	}

	async function fetchWeather(latitude, longitude) {
		const url = new URL('https://api.open-meteo.com/v1/forecast');
		url.searchParams.set('latitude', String(latitude));
		url.searchParams.set('longitude', String(longitude));
		url.searchParams.set('timezone', 'auto');
		url.searchParams.set(
			'current',
			'temperature_2m,apparent_temperature,weather_code,wind_speed_10m'
		);
		url.searchParams.set('temperature_unit', 'fahrenheit');
		url.searchParams.set('wind_speed_unit', 'mph');

		const res = await fetch(url);
		if (!res.ok) throw new Error('Failed to fetch weather');
		const data = await res.json();

		const current = data?.current;
		if (!current) throw new Error('Weather data unavailable');

		temperatureUnit = data?.current_units?.temperature_2m ?? '°F';
		windUnit = data?.current_units?.wind_speed_10m ?? 'mph';

		return {
			temperature_2m: current.temperature_2m,
			apparent_temperature: current.apparent_temperature,
			weather_code: current.weather_code,
			wind_speed_10m: current.wind_speed_10m,
			time: current.time
		};
	}

	async function refreshWithCoords(nextCoords) {
		status = 'loading';
		errorMessage = null;

		try {
			const [nextPlace, nextWeather] = await Promise.all([
				fetchPlace(nextCoords.latitude, nextCoords.longitude).catch(() => null),
				fetchWeather(nextCoords.latitude, nextCoords.longitude)
			]);
			coords = nextCoords;
			place = nextPlace;
			weather = nextWeather;
			status = 'ready';
		} catch (err) {
			status = 'error';
			errorMessage = err instanceof Error ? err.message : 'Failed to load weather';
		}
	}

	async function enable() {
		if (!hasGeolocation) return;
		setEnabled(true);
		await refresh(true);
	}

	async function refresh(forceAsk = false) {
		if (!hasGeolocation) return;

		const stored = coords ?? loadStoredCoords();
		if (stored && !forceAsk) {
			await refreshWithCoords(stored);
			return;
		}

		status = 'loading';
		errorMessage = null;

		try {
			const pos = await getCurrentPosition();
			const nextCoords = {
				latitude: pos.coords.latitude,
				longitude: pos.coords.longitude
			};
			storeCoords(nextCoords);
			await refreshWithCoords(nextCoords);
		} catch (err) {
			status = 'error';
			if (err && typeof err === 'object' && 'code' in err) {
				// GeolocationPositionError codes: 1 permission denied, 2 unavailable, 3 timeout
				const code = err.code;
				if (code === 1) errorMessage = 'Location permission denied';
				else if (code === 2) errorMessage = 'Location unavailable';
				else if (code === 3) errorMessage = 'Location request timed out';
				else errorMessage = 'Failed to get location';
			} else {
				errorMessage = err instanceof Error ? err.message : 'Failed to get location';
			}
		}
	}

	onMount(async () => {
		hasGeolocation = typeof navigator !== 'undefined' && 'geolocation' in navigator;
		if (!hasGeolocation) return;

		const stored = loadStoredCoords();
		if (stored) coords = stored;

		// Only auto-refresh if the user previously enabled it AND we already have stored coordinates,
		// so we don't unexpectedly trigger the browser permission prompt on page load.
		if (isEnabled() && stored) {
			await refresh(false);
		}
	});
</script>

<div class="weather-widget" aria-live="polite">
	{#if !hasGeolocation}
		<span class="weather-muted">Weather unavailable</span>
	{:else if status === 'idle'}
		<button class="weather-btn" type="button" on:click={enable}>Show local weather</button>
	{:else if status === 'loading'}
		<span class="weather-muted">Loading weather…</span>
	{:else if status === 'error'}
		<div class="weather-error">
			<span class="weather-error-text">{errorMessage ?? 'Failed to load weather'}</span>
			<button class="weather-btn secondary" type="button" on:click={() => refresh(true)}
				>Retry</button
			>
		</div>
	{:else}
		<div class="weather-ready">
			<div class="weather-top">
				<div class="weather-place" title={formatPlace(place, coords)}>
					{formatPlace(place, coords)}
				</div>
				<button
					class="weather-refresh"
					type="button"
					on:click={() => refresh(false)}
					title="Refresh weather"
				>
					Refresh
				</button>
			</div>
			<div class="weather-bottom">
				<span class="weather-temp">
					{Math.round(weather.temperature_2m)}{temperatureUnit}
				</span>
				<span class="weather-desc">{wmoLabel(weather.weather_code)}</span>
				<span class="weather-wind">{Math.round(weather.wind_speed_10m)} {windUnit}</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.weather-widget {
		display: flex;
		align-items: center;
	}

	.weather-muted {
		color: #d1d5db;
		font-size: 0.875rem;
		white-space: nowrap;
	}

	.weather-btn {
		background: #2f2f2f;
		border: 1px solid #383838;
		color: #ffffff;
		font-size: 0.875rem;
		border-radius: 10px;
		padding: 0.35rem 0.65rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.weather-btn:hover {
		background: #3a3a3a;
	}

	.weather-btn.secondary {
		background: transparent;
	}

	.weather-ready {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		border: 1px solid #383838;
		background: rgba(255, 255, 255, 0.04);
		border-radius: 12px;
		padding: 0.35rem 0.6rem;
		min-width: 210px;
	}

	.weather-top {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.weather-place {
		font-size: 0.8rem;
		color: #e5e7eb;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 170px;
	}

	.weather-refresh {
		margin-left: auto;
		background: transparent;
		border: 1px solid #383838;
		color: #d1d5db;
		font-size: 0.75rem;
		border-radius: 10px;
		padding: 0.15rem 0.45rem;
		cursor: pointer;
	}

	.weather-refresh:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	.weather-bottom {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.weather-temp {
		color: #ffffff;
		font-weight: 600;
		font-size: 0.95rem;
	}

	.weather-desc {
		color: #d1d5db;
		font-size: 0.85rem;
	}

	.weather-wind {
		color: #9ca3af;
		font-size: 0.8rem;
	}

	.weather-error {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.weather-error-text {
		color: #fca5a5;
		font-size: 0.875rem;
		white-space: nowrap;
	}

	@media (max-width: 768px) {
		.weather-ready {
			min-width: 180px;
		}
		.weather-place {
			max-width: 130px;
		}
	}
</style>
