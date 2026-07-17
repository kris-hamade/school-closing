<script>
	import { onDestroy, onMount } from 'svelte';
	import { locationContext } from '$lib/store.js';

	const DEFAULT_LOCATION = { name: 'Lansing', latitude: 42.7325, longitude: -84.5555 };
	const CACHE_KEY = 'school-closures-weather';
	const REFRESH_INTERVAL = 15 * 60 * 1000;

	let weather = null;
	let locationName = DEFAULT_LOCATION.name;
	let loading = true;
	let locating = false;
	let error = '';
	let controller;
	let refreshTimer;
	let weatherRequestId = 0;
	let activeLocation = DEFAULT_LOCATION;

	const weatherCodes = {
		0: ['Clear', '☀️'],
		1: ['Mostly clear', '🌤️'],
		2: ['Partly cloudy', '⛅'],
		3: ['Cloudy', '☁️'],
		45: ['Foggy', '🌫️'],
		48: ['Icy fog', '🌫️'],
		51: ['Light drizzle', '🌦️'],
		53: ['Drizzle', '🌦️'],
		55: ['Heavy drizzle', '🌧️'],
		61: ['Light rain', '🌦️'],
		63: ['Rain', '🌧️'],
		65: ['Heavy rain', '🌧️'],
		71: ['Light snow', '🌨️'],
		73: ['Snow', '🌨️'],
		75: ['Heavy snow', '❄️'],
		77: ['Snow grains', '🌨️'],
		80: ['Rain showers', '🌦️'],
		81: ['Rain showers', '🌧️'],
		82: ['Heavy showers', '⛈️'],
		85: ['Snow showers', '🌨️'],
		86: ['Heavy snow showers', '❄️'],
		95: ['Thunderstorms', '⛈️'],
		96: ['Storms with hail', '⛈️'],
		99: ['Severe storms', '⛈️']
	};

	function getCondition(code) {
		return weatherCodes[code] || ['Current conditions', '🌡️'];
	}

	function readCache() {
		try {
			const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
			if (cached?.weather && Date.now() - cached.savedAt < REFRESH_INTERVAL) {
				weather = cached.weather;
				locationName = cached.locationName || DEFAULT_LOCATION.name;
				activeLocation = cached.location || DEFAULT_LOCATION;
				return true;
			}
		} catch {
			// A malformed cache should never prevent fresh weather from loading.
		}
		return false;
	}

	async function fetchWeather(location = DEFAULT_LOCATION, showLoading = false) {
		const requestId = ++weatherRequestId;
		if (showLoading) loading = true;
		controller?.abort();
		const requestController = new AbortController();
		controller = requestController;
		const timeout = setTimeout(() => requestController.abort(), 8000);

		try {
			const params = new URLSearchParams({
				latitude: location.latitude,
				longitude: location.longitude,
				current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
				daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
				temperature_unit: 'fahrenheit',
				wind_speed_unit: 'mph',
				timezone: 'auto',
				forecast_days: '1'
			});
			const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
				signal: requestController.signal
			});
			if (!response.ok) throw new Error(`Weather service returned ${response.status}`);
			const data = await response.json();
			if (!data.current || !data.daily) throw new Error('Weather data was incomplete');
			if (requestId !== weatherRequestId) return;

			weather = {
				...data.current,
				high: data.daily.temperature_2m_max?.[0],
				low: data.daily.temperature_2m_min?.[0],
				precipitation: data.daily.precipitation_probability_max?.[0]
			};
			activeLocation = location;
			locationName = location.name;
			error = '';
			localStorage.setItem(
				CACHE_KEY,
				JSON.stringify({ weather, locationName, location, savedAt: Date.now() })
			);
		} catch (requestError) {
			if (requestId === weatherRequestId && (requestError.name !== 'AbortError' || !weather)) {
				error = weather ? 'Weather may be out of date' : 'Weather unavailable';
			}
		} finally {
			clearTimeout(timeout);
			if (requestId === weatherRequestId) {
				loading = false;
				locating = false;
			}
		}
	}

	async function resolveSchoolLocation(location) {
		locationContext.set({ status: 'locating', county: null, city: null });
		try {
			const params = new URLSearchParams({
				lat: location.latitude,
				lon: location.longitude
			});
			const response = await fetch(`/api/location?${params}`);
			if (!response.ok) throw new Error(`Location lookup failed (${response.status})`);
			const result = await response.json();
			locationContext.set({
				status: result.county ? 'ready' : 'unmatched',
				county: result.county,
				city: result.city
			});
			return result;
		} catch {
			locationContext.set({ status: 'error', county: null, city: null });
			return null;
		}
	}

	function useMyLocation() {
		if (!navigator.geolocation) {
			error = 'Location is not supported by this browser';
			return;
		}
		locating = true;
		error = '';
		navigator.geolocation.getCurrentPosition(
			async (position) => {
				const location = {
					name: 'Local weather',
					latitude: Number(position.coords.latitude.toFixed(2)),
					longitude: Number(position.coords.longitude.toFixed(2))
				};
				const resolvedLocation = await resolveSchoolLocation(location);
				location.name =
					resolvedLocation?.city ||
					resolvedLocation?.county?.replace(/\s+County$/i, '') ||
					location.name;
				await fetchWeather(location, true);
			},
			() => {
				locating = false;
				error = 'Location permission was not granted';
				locationContext.set({ status: 'denied', county: null, city: null });
			},
			{ enableHighAccuracy: false, timeout: 10000, maximumAge: 30 * 60 * 1000 }
		);
	}

	onMount(() => {
		const hasCachedWeather = readCache();
		if (hasCachedWeather) {
			loading = false;
		} else {
			fetchWeather(DEFAULT_LOCATION, true);
		}
		refreshTimer = setInterval(() => fetchWeather(activeLocation), REFRESH_INTERVAL);

		if (navigator.permissions?.query) {
			navigator.permissions
				.query({ name: 'geolocation' })
				.then((permission) => {
					if (permission.state === 'granted') useMyLocation();
				})
				.catch(() => {});
		}
	});

	onDestroy(() => {
		controller?.abort();
		clearInterval(refreshTimer);
	});
</script>

<section class="weather-widget" aria-label="Current weather">
	{#if loading && !weather}
		<div class="weather-loading" aria-live="polite">
			<span class="weather-skeleton icon-skeleton"></span>
			<span class="weather-skeleton text-skeleton"></span>
		</div>
	{:else if weather}
		{@const condition = getCondition(weather.weather_code)}
		<div class="weather-icon" aria-hidden="true">{condition[1]}</div>
		<div class="weather-main">
			<div class="weather-heading">
				<span class="weather-temp">{Math.round(weather.temperature_2m)}°</span>
				<span class="weather-location">{locationName}</span>
			</div>
			<div class="weather-detail">
				{condition[0]} · H {Math.round(weather.high)}° / L {Math.round(weather.low)}°
			</div>
		</div>
	{:else}
		<div class="weather-main">
			<span class="weather-location">Weather unavailable</span>
			<button class="text-button" on:click={() => fetchWeather(DEFAULT_LOCATION, true)}
				>Try again</button
			>
		</div>
	{/if}

	<button
		class="location-button"
		on:click={useMyLocation}
		disabled={locating}
		title="Use your current location"
		aria-label="Use your current location for weather"
	>
		{#if locating}
			<span class="location-spinner" aria-hidden="true"></span>
		{:else}
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
				<circle cx="12" cy="10" r="2.5" />
			</svg>
		{/if}
	</button>
	{#if error && weather}<span class="sr-only" aria-live="polite">{error}</span>{/if}
</section>

<style>
	.weather-widget {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		min-width: 260px;
		padding: 0.65rem 0.75rem;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 14px;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
	}

	.weather-icon {
		font-size: 1.8rem;
		line-height: 1;
	}
	.weather-main {
		min-width: 0;
		flex: 1;
	}
	.weather-heading {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}
	.weather-temp {
		font-size: 1.35rem;
		font-weight: 750;
		color: #fff;
	}
	.weather-location {
		color: #e5edf8;
		font-size: 0.82rem;
		font-weight: 650;
	}
	.weather-detail {
		color: #9eacc0;
		font-size: 0.7rem;
		white-space: nowrap;
	}

	.location-button,
	.text-button {
		border: 0;
		color: #b9d7ff;
		background: transparent;
		cursor: pointer;
	}
	.location-button {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		flex: 0 0 34px;
		border: 1px solid rgba(117, 183, 255, 0.22);
		border-radius: 10px;
		background: rgba(88, 166, 255, 0.08);
	}
	.location-button svg {
		width: 18px;
		height: 18px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.location-button:hover {
		border-color: rgba(117, 183, 255, 0.5);
		background: rgba(88, 166, 255, 0.18);
		color: #fff;
	}
	.location-button:focus-visible {
		outline: 2px solid #75b7ff;
		outline-offset: 2px;
	}
	.location-button:disabled {
		opacity: 0.55;
		cursor: wait;
	}
	.location-spinner {
		width: 15px;
		height: 15px;
		border: 2px solid rgba(185, 215, 255, 0.35);
		border-top-color: currentColor;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	.text-button {
		padding: 0;
		font-size: 0.72rem;
		text-decoration: underline;
	}

	.weather-loading {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex: 1;
	}
	.weather-skeleton {
		display: block;
		background: #303b49;
		border-radius: 8px;
		animation: pulse 1.4s infinite;
	}
	.icon-skeleton {
		width: 34px;
		height: 34px;
	}
	.text-skeleton {
		width: 135px;
		height: 24px;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	@keyframes pulse {
		50% {
			opacity: 0.45;
		}
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 700px) {
		.weather-widget {
			min-width: 0;
			width: 100%;
		}
	}
</style>
