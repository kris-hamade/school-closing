<script>
	import { onDestroy, onMount, tick } from 'svelte';
	import { backendSource, lastUpdated, locationContext } from '$lib/store.js';
	import { getClosuresUrl } from '$lib/config.js';

	export let isdFilter = 'all';
	const priorityISDs = ['Oakland Schools', 'Wayne County Regional Educational Service Agency']; // Define your priority ISDs

	let closures = {};
	let metadata = null;
	let isdStatus = {};
	let loading = true;
	let initialLoad = true;
	let error = null;
	let refreshError = null;
	let retrying = false;
	let searchQuery = '';
	let searchResults = [];
	let searching = false;
	let searchError = null;
	let retryingSearch = false;
	let expandedISDs = new Set();
	let expandedCounties = new Set();
	let filteredISDEntries = [];
	let hasManualISDSelection = false;
	let lastLocationCounty = '';
	let locationMessage = '';
	let dataVersion = 0;
	let searchRequestId = 0;
	let searchController;
	let closuresController;
	let refreshInterval;
	const countyEntriesCache = new Map();
	const schoolEntriesCache = new Map();

	// Debounce search
	let searchTimeout;
	function debounceSearch(query) {
		clearTimeout(searchTimeout);
		if (!query.trim()) {
			searchResults = [];
			searching = false;
			return;
		}
		searching = true;
		searchTimeout = setTimeout(async () => {
			await performSearch(query);
		}, 300);
	}

	async function performSearch(query, isRetry = false) {
		const normalizedQuery = query.trim();
		const requestId = ++searchRequestId;
		searchController?.abort();
		searchController = new AbortController();
		const timeout = setTimeout(() => searchController.abort(), 8000);
		try {
			if (isRetry) {
				retryingSearch = true;
				searchError = null;
			}
			searchError = null;
			const encodedQuery = encodeURIComponent(normalizedQuery);
			const res = await fetch(getClosuresUrl(`school/${encodedQuery}`), {
				signal: searchController.signal
			});
			if (!res.ok) {
				throw new Error(`Search failed (${res.status})`);
			}
			const data = await res.json();
			if (requestId !== searchRequestId) return;
			searchResults = Array.isArray(data.results) ? data.results : [];
			searchError = null; // Clear error on success
		} catch (err) {
			if (requestId !== searchRequestId || err.name === 'AbortError') return;
			console.error(err);
			searchError = 'School search is temporarily unavailable.';
			searchResults = [];
		} finally {
			clearTimeout(timeout);
			if (requestId === searchRequestId) {
				searching = false;
				retryingSearch = false;
			}
		}
	}

	async function handleSearchRetry(event) {
		if (event) {
			event.preventDefault();
			event.stopPropagation();
		}
		await performSearch(searchQuery, true);
	}

	async function fetchClosures(isRetry = false) {
		const hasExistingData = Object.keys(closures).length > 0;
		closuresController?.abort();
		closuresController = new AbortController();
		const timeout = setTimeout(() => closuresController.abort(), 12000);
		try {
			if (isRetry) {
				retrying = true;
				error = null;
			} else {
				const shouldShowLoading = initialLoad;
				if (shouldShowLoading) {
					loading = true;
				}
			}
			const res = await fetch(getClosuresUrl(), {
				signal: closuresController.signal
			});
			const connectedBackend = res.headers.get('x-closures-upstream');
			if (connectedBackend === 'local' || connectedBackend === 'production') {
				backendSource.set(connectedBackend);
			}
			if (!res.ok) {
				throw new Error(`Failed to fetch closures data (${res.status})`);
			}
			const data = await res.json();
			if (!data || typeof data !== 'object') throw new Error('Invalid closures response');

			// Clear cache when new data arrives
			countyEntriesCache.clear();
			schoolEntriesCache.clear();

			// Handle new API structure
			if (data.closures) {
				closures = data.closures;
				metadata = data.metadata || null;
				isdStatus = data.isdStatus || {};
			} else {
				// Backward compatibility: if old structure, use directly
				closures = data;
				metadata = data.metadata || null;
				isdStatus = {};
			}

			// Provide a fallback metadata object so timestamps are always available
			if (!metadata) {
				metadata = {
					lastUpdated: new Date().toISOString(),
					fetchError: null,
					dataSource: null,
					pullHistory: []
				};
			}

			if (metadata?.lastUpdated) {
				lastUpdated.set(new Date(metadata.lastUpdated).toLocaleString());
			} else {
				lastUpdated.set(new Date().toLocaleString());
			}
			dataVersion += 1;
			initialLoad = false;
			error = null; // Clear error on success
			refreshError = null;
		} catch (err) {
			backendSource.set('unavailable');
			if (err.name === 'AbortError' && hasExistingData) return;
			console.error(err);
			if (hasExistingData) {
				refreshError = 'Could not refresh. Showing the most recent data available.';
			} else {
				error = 'Closure data is temporarily unavailable. Please try again.';
			}
		} finally {
			clearTimeout(timeout);
			// Only flip loading off if we turned it on for this fetch (not during retry)
			if (loading && !isRetry) {
				loading = false;
			}
			retrying = false;
		}
	}

	async function handleRetry(event) {
		if (event) {
			event.preventDefault();
			event.stopPropagation();
		}
		await fetchClosures(true);
	}

	function getISDs() {
		const allISDs = Object.keys(closures);
		const priority = allISDs.filter((isd) => priorityISDs.includes(isd));
		const nonPriority = allISDs
			.filter((isd) => !priorityISDs.includes(isd))
			.sort((a, b) => a.localeCompare(b));
		return [...priority, ...nonPriority];
	}

	function getFilteredISDEntries(filter, closureData) {
		if (filter === 'all') {
			return getISDs().map((isd) => [isd, closureData[isd]]);
		}
		return closureData[filter] ? [[filter, closureData[filter]]] : [];
	}

	// Pass the dependencies explicitly so Svelte recomputes the rendered list
	// whenever either the selected ISD or closure payload changes.
	$: filteredISDEntries = getFilteredISDEntries(isdFilter, closures);

	function getISDStatus(isdName) {
		return isdStatus[isdName] || null;
	}

	function getISDLastUpdated(isdName) {
		if (!closures[isdName]) return null;

		let mostRecent = null;

		// Structure: closures[isdName][countyName][schoolName] = schoolData
		// Iterate through all counties
		Object.values(closures[isdName]).forEach((countyData) => {
			// countyData is an object with school names as keys
			Object.values(countyData).forEach((schoolData) => {
				// schoolData is the school object with lastChecked, closed, etc.
				if (schoolData && schoolData.lastChecked) {
					try {
						const timestamp = new Date(schoolData.lastChecked).getTime();
						if (!isNaN(timestamp) && (!mostRecent || timestamp > mostRecent)) {
							mostRecent = timestamp;
						}
					} catch (e) {
						// Invalid date, skip
					}
				}
			});
		});

		// If no lastChecked found in schools, fall back to metadata.lastUpdated
		if (!mostRecent && metadata && metadata.lastUpdated) {
			try {
				const metaTimestamp = new Date(metadata.lastUpdated).getTime();
				if (!isNaN(metaTimestamp)) {
					mostRecent = metaTimestamp;
				}
			} catch (e) {
				// Invalid date, skip
			}
		}

		return mostRecent ? new Date(mostRecent) : null;
	}

	function formatRelativeTime(date) {
		if (!date) return '';

		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;

		// For older dates, show formatted date
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function formatDateTimeString(dateStr) {
		if (!dateStr) return null;
		const date = new Date(dateStr);
		return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
	}

	function getSchoolTooltip(schoolData) {
		// Prefer lastStatusChange when available (when the status actually flipped)
		const statusChangeTs = formatDateTimeString(schoolData?.lastStatusChange);
		if (statusChangeTs) {
			return `Last status change: ${statusChangeTs}`;
		}

		// Fall back to lastChecked (when we last verified)
		const lastCheckedTs = formatDateTimeString(schoolData?.lastChecked);
		if (lastCheckedTs) {
			return `Last checked: ${lastCheckedTs}`;
		}

		// Fallback to overall metadata timestamp
		const metaTimestamp = formatDateTimeString(metadata?.lastUpdated);
		if (metaTimestamp) {
			return `Last updated: ${metaTimestamp}`;
		}

		return 'Last updated: not available';
	}

	// Memoize county stats to avoid recalculating
	const countyStatsCache = new WeakMap();
	function getCountyStats(schools) {
		if (countyStatsCache.has(schools)) {
			return countyStatsCache.get(schools);
		}
		const schoolEntries = Object.entries(schools);
		const closedCount = schoolEntries.filter(([_, data]) => data.closed).length;
		const stats = {
			total: schoolEntries.length,
			closed: closedCount,
			open: schoolEntries.length - closedCount
		};
		countyStatsCache.set(schools, stats);
		return stats;
	}

	function getCountyEntries(isd, counties) {
		const cacheKey = `${dataVersion}|${isd}`;
		if (countyEntriesCache.has(cacheKey)) return countyEntriesCache.get(cacheKey);
		const entries = Object.entries(counties).sort(([a], [b]) => a.localeCompare(b));
		countyEntriesCache.set(cacheKey, entries);
		return entries;
	}

	function getSchoolEntries(isd, county, schools) {
		const cacheKey = `${dataVersion}|${isd}|${county}`;
		if (schoolEntriesCache.has(cacheKey)) return schoolEntriesCache.get(cacheKey);
		const entries = Object.entries(schools).sort(([a], [b]) => a.localeCompare(b));
		schoolEntriesCache.set(cacheKey, entries);
		return entries;
	}

	function toggleISD(isdName, event) {
		if (event) {
			event.preventDefault();
			event.stopPropagation();
		}
		// Create a completely new Set to ensure Svelte reactivity
		const newSet = new Set(expandedISDs);
		if (newSet.has(isdName)) {
			newSet.delete(isdName);
		} else {
			newSet.add(isdName);
		}
		// Force reactivity by reassigning
		expandedISDs = newSet;
	}

	function toggleCounty(isdName, countyName, event) {
		if (event) {
			event.preventDefault();
			event.stopPropagation();
		}
		const key = `${isdName}|${countyName}`;
		// Create a completely new Set to ensure Svelte reactivity
		const wasExpanded = expandedCounties.has(key);
		const newSet = new Set(expandedCounties);
		if (wasExpanded) {
			newSet.delete(key);
		} else {
			newSet.add(key);
		}
		// Force reactivity by reassigning - this is critical for Svelte
		expandedCounties = new Set(newSet);
	}

	// Reactive derived value for county expansion state - convert Set to Array for reactivity
	$: expandedCountiesArray = Array.from(expandedCounties);

	function clearSearch() {
		searchRequestId += 1;
		searchController?.abort();
		searchQuery = '';
		searchResults = [];
		searchError = null;
		searching = false;
	}

	async function applyISDFilter(nextFilter, { persist = false, manual = false } = {}) {
		isdFilter = nextFilter === 'all' || closures[nextFilter] ? nextFilter : 'all';
		expandedISDs = new Set();
		expandedCounties = new Set();

		if (isdFilter !== 'all') {
			expandedISDs = new Set([isdFilter]);
			await expandAllCountiesForISD(isdFilter);
		}

		if (persist) sessionStorage.setItem('selectedISD', isdFilter);
		if (manual) {
			hasManualISDSelection = true;
			locationMessage = '';
		}
	}

	function handleISDChange(event) {
		applyISDFilter(event.currentTarget.value, { persist: true, manual: true });
	}

	function loadISDFromSession() {
		const storedISD = sessionStorage.getItem('selectedISD');
		if (storedISD) {
			isdFilter = storedISD;
		} else {
			isdFilter = 'all';
		}
	}

	function normalizeCountyName(county) {
		return (
			county
				?.replace(/\s+County$/i, '')
				.trim()
				.toLocaleLowerCase() || ''
		);
	}

	function findISDForCounty(county) {
		const targetCounty = normalizeCountyName(county);
		if (!targetCounty) return null;
		return (
			getISDs().find((isd) =>
				Object.keys(closures[isd] || {}).some(
					(countyName) => normalizeCountyName(countyName) === targetCounty
				)
			) || null
		);
	}

	async function focusSearchResult(result) {
		if (!result?.isd || !closures[result.isd]) return;
		searchRequestId += 1;
		searchController?.abort();
		searchQuery = '';
		searchResults = [];
		searching = false;
		await applyISDFilter(result.isd, { persist: true, manual: true });
		await tick();
		requestAnimationFrame(() => {
			document
				.getElementById(`isd-${encodeURIComponent(result.isd)}`)
				?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		});
	}

	async function expandAllCountiesForISD(isdName) {
		if (!closures[isdName]) return;
		const newSet = new Set(expandedCounties);
		// Iterate through counties properly - closures[isdName] is an object with county keys
		Object.keys(closures[isdName]).forEach((county) => {
			const key = `${isdName}|${county}`;
			newSet.add(key);
		});
		// Force reactivity by creating a completely new Set
		expandedCounties = new Set(newSet);
		// Wait for DOM to update to ensure template reactivity
		await tick();
	}

	onMount(() => {
		loadISDFromSession();
		fetchClosures().then(() => applyISDFilter(isdFilter));
		refreshInterval = setInterval(fetchClosures, 60000);
	});

	onDestroy(() => {
		clearInterval(refreshInterval);
		clearTimeout(searchTimeout);
		searchController?.abort();
		closuresController?.abort();
	});

	$: if (
		$locationContext.status === 'ready' &&
		$locationContext.county &&
		Object.keys(closures).length > 0 &&
		$locationContext.county !== lastLocationCounty
	) {
		lastLocationCounty = $locationContext.county;
		const locatedISD = findISDForCounty($locationContext.county);
		if (locatedISD && (!hasManualISDSelection || isdFilter === 'all')) {
			locationMessage = `Showing ${locatedISD} for ${$locationContext.county}`;
			applyISDFilter(locatedISD);
		} else if (!locatedISD) {
			locationMessage = `No Michigan ISD match was found for ${$locationContext.county}`;
		}
	}
</script>

<!-- Search and Filter Section -->
<section class="controls-section" aria-label="Closure filters">
	<div class="filter-container">
		<label for="isd-selector">Select ISD</label>
		<select
			id="isd-selector"
			bind:value={isdFilter}
			on:change={handleISDChange}
			class="p-2 rounded border bg-gray-800 text-white"
		>
			<option value="all">All ISDs</option>
			{#if closures && Object.keys(closures).length > 0}
				{#each getISDs() as isd}
					<option value={isd}>{isd}</option>
				{/each}
			{/if}
		</select>
		{#if locationMessage}<p class="location-context" role="status">{locationMessage}</p>{/if}
	</div>

	<div class="search-container">
		<label for="school-search">Find your school</label>
		<div class="search-input-wrapper">
			<input
				id="school-search"
				type="search"
				bind:value={searchQuery}
				on:input={(e) => debounceSearch(e.currentTarget.value)}
				placeholder="Search by school name"
				autocomplete="off"
				class="p-2 rounded border bg-gray-800 text-white flex-1"
			/>
			{#if searchQuery}
				<button on:click={clearSearch} class="clear-search-btn" aria-label="Clear search">
					×
				</button>
			{/if}
		</div>
	</div>
</section>

{#if refreshError}
	<div class="refresh-notice" role="status">
		<span aria-hidden="true">!</span>
		{refreshError}
		<button on:click={handleRetry} disabled={retrying}
			>{retrying ? 'Refreshing…' : 'Refresh now'}</button
		>
	</div>
{/if}

<!-- Statistics Dashboard -->
{#if !loading && !error && metadata && isdFilter === 'all'}
	<div class="stats-dashboard mb-6">
		<div class="stat-card">
			<div class="stat-value">{metadata.totalSchools ?? 0}</div>
			<div class="stat-label">Total Schools</div>
		</div>
		<div class="stat-card stat-closed">
			<div class="stat-value">{metadata.closedSchools ?? 0}</div>
			<div class="stat-label">Closed</div>
		</div>
		<div class="stat-card stat-open">
			<div class="stat-value">{(metadata.totalSchools ?? 0) - (metadata.closedSchools ?? 0)}</div>
			<div class="stat-label">Open</div>
		</div>
		{#if metadata.fetchError}
			<div class="stat-card stat-warning">
				<div class="stat-label">⚠️ Using cached data</div>
				<div class="stat-sublabel">{metadata.fetchError}</div>
			</div>
		{/if}
	</div>
{/if}

<!-- Loading State -->
{#if loading}
	<div class="loading-container">
		<div class="spinner"></div>
		<p class="mt-4 text-yellow-400">Loading data...</p>
	</div>
	<!-- Error State -->
{:else if error}
	<div class="error-container">
		{#if retrying}
			<div class="loading-container">
				<div class="spinner"></div>
				<p class="mt-4 text-yellow-400">Retrying...</p>
			</div>
		{:else}
			<p class="text-red-500">⚠️ {error}</p>
			<button on:click={handleRetry} class="retry-btn">Retry</button>
		{/if}
	</div>
	<!-- Search Results -->
{:else if searchQuery}
	{#if searching}
		<div class="loading-container">
			<div class="spinner"></div>
			<p class="mt-4 text-yellow-400">Searching...</p>
		</div>
	{:else if searchError}
		<div class="error-container">
			{#if retryingSearch}
				<div class="loading-container">
					<div class="spinner"></div>
					<p class="mt-4 text-yellow-400">Retrying search...</p>
				</div>
			{:else}
				<p class="text-red-500">⚠️ {searchError}</p>
				<button on:click={handleSearchRetry} class="retry-btn">Retry</button>
			{/if}
		</div>
	{:else if searchResults.length > 0}
		<div class="search-results-container">
			<h2 class="text-2xl font-bold mb-4">Search Results for "{searchQuery}"</h2>
			<div class="search-results-list">
				{#each searchResults as result}
					<button class="search-result-item" on:click={() => focusSearchResult(result)}>
						<div class="result-header">
							<span class="result-school-name">{result.school}</span>
							<span
								class="status-badge"
								class:badge-closed={result.closed}
								class:badge-open={!result.closed}
								title={getSchoolTooltip(result)}
							>
								{result.closed ? 'Closed' : 'Open'}
							</span>
						</div>
						<div class="result-details">
							<span class="result-isd">{result.isd}</span>
							<span class="result-separator">•</span>
							<span class="result-county">{result.county}</span>
						</div>
						<span class="view-district">View district</span>
					</button>
				{/each}
			</div>
		</div>
	{:else}
		<div class="empty-state">
			<p>No schools found matching "{searchQuery}"</p>
			<button on:click={clearSearch} class="clear-search-link">Clear search</button>
		</div>
	{/if}
	<!-- Main Closures Display -->
{:else}
	<div id="closure-container" class="mt-4">
		{#if filteredISDEntries.length === 0}
			<div class="empty-state">
				<p>No closure data available</p>
			</div>
		{:else}
			{#each filteredISDEntries as [isd, counties] (isd)}
				{@const status = getISDStatus(isd)}
				{@const isExpanded = expandedISDs.has(isd)}
				<div class="isd-block" id={`isd-${encodeURIComponent(isd)}`}>
					<div
						class="isd-header"
						on:click={(e) => toggleISD(isd, e)}
						role="button"
						tabindex="0"
						aria-expanded={isExpanded}
						on:keydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								toggleISD(isd, e);
							}
						}}
					>
						<div class="isd-header-content">
							<span class="expand-icon">{isExpanded ? '▼' : '▶'}</span>
							<h2 class="text-2xl font-bold">{isd}</h2>
							{#if status}
								<div class="isd-status-badges">
									{#if status.allClosed}
										<span class="badge badge-all-closed">All Closed</span>
									{:else if status.closedCount > 0}
										<span class="badge badge-partial"
											>{status.closedCount} of {status.totalCount} Closed</span
										>
									{:else}
										<span class="badge badge-open">All Open</span>
									{/if}
								</div>
							{/if}
						</div>
					</div>
					{#if isExpanded}
						<div class="isd-content">
							{#each getCountyEntries(isd, counties) as [county, schools] (county)}
								{@const countyStats = getCountyStats(schools)}
								{@const countyKey = `${isd}|${county}`}
								{@const countyExpanded = expandedCountiesArray.includes(countyKey)}
								<div class="county-block">
									<div
										class="county-header"
										on:click={(e) => toggleCounty(isd, county, e)}
										role="button"
										tabindex="0"
										aria-expanded={countyExpanded}
										on:keydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												toggleCounty(isd, county, e);
											}
										}}
									>
										<span class="expand-icon small">{countyExpanded ? '▼' : '▶'}</span>
										<h3 class="text-xl font-semibold">{county}</h3>
										{#if countyStats.closed === 0}
											<span class="badge badge-open county-badge">ALL OPEN</span>
										{:else if countyStats.closed === countyStats.total}
											<span class="badge badge-all-closed county-badge">ALL CLOSED</span>
										{:else}
											<span class="badge badge-partial county-badge">
												{countyStats.closed} OF {countyStats.total} CLOSED
											</span>
										{/if}
									</div>
									{#if countyExpanded}
										<div class="schools-list">
											{#each getSchoolEntries(isd, county, schools) as [schoolName, data] (schoolName)}
												<div class="school-item">
													<span class="school-name">{schoolName}</span>
													<span
														class="status-badge"
														class:badge-closed={data.closed}
														class:badge-open={!data.closed}
														title={getSchoolTooltip(data)}
													>
														{data.closed ? '● Closed' : '● Open'}
													</span>
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
{/if}

<style>
	.text-yellow-400 {
		color: #fbbf24;
	}
	.text-red-500 {
		color: #ef4444;
	}

	/* Controls Section */
	.controls-section {
		display: grid;
		grid-template-columns: minmax(240px, 0.9fr) minmax(280px, 1.1fr);
		gap: 1.1rem;
		width: 100%;
		padding: 1rem;
		margin-bottom: 1.2rem;
		background: rgba(20, 29, 41, 0.9);
		border: 1px solid rgba(255, 255, 255, 0.09);
		border-radius: 16px;
		box-shadow: 0 14px 40px rgba(0, 0, 0, 0.16);
	}

	.filter-container,
	.search-container {
		width: 100%;
		max-width: none;
	}

	.filter-container label,
	.search-container label {
		display: block;
		color: #aebbd0;
		margin-bottom: 0.5rem;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.search-input-wrapper {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		position: relative;
	}

	#school-search {
		width: 100%;
		background-color: #0b111a;
		border: 1px solid #344155;
		color: white;
		padding: 0.75rem 2.8rem 0.75rem 0.9rem;
		border-radius: 10px;
		box-sizing: border-box;
	}

	#school-search:focus {
		outline: none;
		border-color: #69adf8;
		box-shadow: 0 0 0 3px rgba(74, 158, 255, 0.13);
	}

	.clear-search-btn {
		position: absolute;
		right: 0.45rem;
		background: #273448;
		border: none;
		color: white;
		font-size: 1.2rem;
		width: 28px;
		height: 28px;
		min-width: 32px;
		min-height: 32px;
		aspect-ratio: 1 / 1;
		border-radius: 50%;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		padding: 0;
	}

	.clear-search-btn:hover {
		background: #4a4a4a;
	}

	#isd-selector {
		width: 100%;
		max-width: none;
		background-color: #0b111a;
		border: 1px solid #344155;
		color: white;
		padding: 0.75rem 0.9rem;
		border-radius: 10px;
		box-sizing: border-box;
	}

	#isd-selector:focus {
		outline: none;
		border-color: #69adf8;
		box-shadow: 0 0 0 3px rgba(74, 158, 255, 0.13);
	}

	#isd-selector option {
		background-color: #0b111a;
		color: white;
	}

	.location-context {
		margin: 0.5rem 0 0;
		color: #75b7ff;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: none;
		letter-spacing: 0;
	}

	.refresh-notice {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		margin: 0 0 1.2rem;
		padding: 0.75rem 0.9rem;
		color: #f7d58b;
		background: rgba(251, 191, 36, 0.08);
		border: 1px solid rgba(251, 191, 36, 0.3);
		border-radius: 10px;
		font-size: 0.84rem;
	}

	.refresh-notice > span {
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		border: 1px solid #f3c75b;
		border-radius: 50%;
		font-weight: 800;
	}

	.refresh-notice button {
		margin-left: auto;
		border: 0;
		color: #ffdf8a;
		background: transparent;
		font-weight: 700;
		cursor: pointer;
	}

	.refresh-notice button:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	/* Statistics Dashboard */
	.stats-dashboard {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.stat-card {
		background-color: #141d29;
		border-radius: 14px;
		padding: 1.5rem;
		text-align: center;
		border: 1px solid #2a3749;
	}

	.stat-card.stat-closed {
		border-color: #ef4444;
		background-color: rgba(239, 68, 68, 0.1);
	}

	.stat-card.stat-open {
		border-color: #22c55e;
		background-color: rgba(34, 197, 94, 0.1);
	}

	.stat-card.stat-warning {
		border-color: #fbbf24;
		background-color: rgba(251, 191, 36, 0.1);
	}

	.stat-value {
		font-size: 2rem;
		font-weight: bold;
		color: white;
		margin-bottom: 0.5rem;
	}

	.stat-label {
		font-size: 0.875rem;
		color: #dcdcdc;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.stat-sublabel {
		font-size: 0.75rem;
		color: #a0a0a0;
		margin-top: 0.25rem;
	}

	/* Loading State */
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem;
	}

	.spinner {
		border: 4px solid #383838;
		border-top: 4px solid #4a9eff;
		border-radius: 50%;
		width: 50px;
		height: 50px;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	/* Error State */
	.error-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2rem;
		background-color: rgba(239, 68, 68, 0.1);
		border: 1px solid #ef4444;
		border-radius: 8px;
	}

	.retry-btn {
		background-color: #ef4444;
		color: white;
		border: none;
		padding: 0.5rem 1.5rem;
		border-radius: 5px;
		cursor: pointer;
		font-weight: 500;
	}

	.retry-btn:hover {
		background-color: #dc2626;
	}

	/* Search Results */
	.search-results-container {
		max-width: 900px;
		margin: 0 auto;
	}

	.search-results-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.search-result-item {
		display: block;
		width: 100%;
		background-color: #1e1e1e;
		border: 1px solid #383838;
		border-radius: 8px;
		padding: 1rem;
		color: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 0.2s,
			transform 0.2s;
	}

	.search-result-item:hover {
		border-color: #69adf8;
		transform: translateY(-1px);
	}

	.search-result-item:focus-visible {
		outline: 2px solid #75b7ff;
		outline-offset: 2px;
	}

	.result-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.result-school-name {
		font-size: 1.125rem;
		font-weight: 600;
		color: white;
	}

	.result-details {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: #a0a0a0;
		margin-top: 0.5rem;
	}

	.result-separator {
		color: #383838;
	}

	.view-district {
		margin-left: auto;
		color: #75b7ff;
		font-weight: 650;
	}

	/* Empty State */
	.empty-state {
		text-align: center;
		padding: 3rem;
		color: #a0a0a0;
	}

	.clear-search-link {
		background: none;
		border: none;
		color: #4a9eff;
		cursor: pointer;
		text-decoration: underline;
		margin-top: 0.5rem;
	}

	.clear-search-link:hover {
		color: #6bb3ff;
	}

	/* Closure Container */
	#closure-container {
		max-width: 1000px;
		margin: 0 auto;
	}

	/* ISD Block */
	.isd-block {
		scroll-margin-top: 1.25rem;
		background-color: #131c28;
		border: 1px solid #2a3749;
		border-radius: 14px;
		margin-bottom: 1.5rem;
		overflow: hidden;
		box-shadow: 0 14px 35px rgba(0, 0, 0, 0.14);
	}

	.isd-header {
		background-color: #182332;
		padding: 1.25rem 1.5rem;
		cursor: pointer;
		user-select: none;
		transition: background-color 0.2s;
	}

	.isd-header:hover {
		background-color: #1d2b3d;
	}

	.isd-header:focus-visible,
	.county-header:focus-visible {
		outline: 2px solid #75b7ff;
		outline-offset: -3px;
	}

	.isd-header-content {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.expand-icon {
		color: #4a9eff;
		font-size: 0.875rem;
		width: 20px;
		text-align: center;
	}

	.expand-icon.small {
		font-size: 0.75rem;
		width: 16px;
	}

	.isd-header h2 {
		font-size: 1.5rem;
		color: white;
		margin: 0;
		flex: 1;
	}

	.isd-status-badges {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.isd-content {
		padding: 1rem 1.5rem;
	}

	/* County Block */
	.county-block {
		margin-bottom: 1rem;
		border-left: 3px solid #383838;
		padding-left: 1rem;
	}

	.county-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		user-select: none;
		padding: 0.75rem 0;
		transition: padding-left 0.2s;
		position: relative;
		z-index: 1;
	}

	.county-header:hover {
		padding-left: 0.5rem;
	}

	.county-header h3 {
		font-size: 1.25rem;
		color: #dcdcdc;
		margin: 0;
		flex: 1;
	}

	.county-badge {
		font-size: 0.75rem;
	}

	.schools-list {
		margin-left: 1.5rem;
		margin-top: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/* School Item */
	.school-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0;
		flex-wrap: wrap;
	}

	.school-name {
		flex: 1;
		min-width: 200px;
		color: white;
	}

	/* Badges */
	.badge {
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.badge-all-closed {
		background-color: rgba(239, 68, 68, 0.2);
		color: #ef4444;
		border: 1px solid #ef4444;
	}

	.badge-partial {
		background-color: rgba(251, 191, 36, 0.2);
		color: #fbbf24;
		border: 1px solid #fbbf24;
	}

	.badge-open {
		background-color: rgba(34, 197, 94, 0.2);
		color: #22c55e;
		border: 1px solid #22c55e;
	}

	.status-badge {
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.status-badge.badge-closed {
		background-color: rgba(239, 68, 68, 0.2);
		color: #ef4444;
		border: 1px solid #ef4444;
	}

	.status-badge.badge-open {
		background-color: rgba(34, 197, 94, 0.2);
		color: #22c55e;
		border: 1px solid #22c55e;
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.controls-section {
			grid-template-columns: 1fr;
		}
		.stats-dashboard {
			grid-template-columns: repeat(2, 1fr);
		}

		.isd-header-content {
			flex-direction: column;
			align-items: flex-start;
		}

		.school-item {
			flex-direction: column;
			align-items: flex-start;
		}

		.county-header {
			flex-wrap: wrap;
		}

		.schools-list {
			margin-left: 0.5rem;
		}
	}

	@media (max-width: 480px) {
		.stats-dashboard {
			grid-template-columns: 1fr;
		}

		.stat-value {
			font-size: 1.5rem;
		}
	}
</style>
