<script>
	import { onMount } from 'svelte';
	import { lastUpdated } from '$lib/store.js';

	export let isdFilter = 'all'; // Allow parent to set or bind this value
	const priorityISDs = ['Oakland Schools', 'Wayne County Regional Educational Service Agency']; // Define your priority ISDs

	let closures = {};
	let loading = true;
	let error = null;

	async function fetchClosures() {
		try {
			loading = true;
			const res = await fetch('https://snowday.hamy.app/api/closures');
			if (!res.ok) {
				throw new Error('Failed to fetch closures data');
			}
			closures = await res.json();
			lastUpdated.set(new Date().toLocaleString());
		} catch (err) {
			console.error(err);
			error = 'Failed to load closures data. Please try again later.';
		} finally {
			loading = false;
		}
	}

	function getISDs() {
		const allISDs = Object.keys(closures);
		const priority = allISDs.filter((isd) => priorityISDs.includes(isd));
		const nonPriority = allISDs.filter((isd) => !priorityISDs.includes(isd));
		return [...priority, ...nonPriority];
	}

	function filteredClosures() {
		if (isdFilter === 'all') return closures;
		const filtered = {};
		if (closures[isdFilter]) {
			filtered[isdFilter] = closures[isdFilter];
		}
		return filtered;
	}

	function saveISDToSession() {
		sessionStorage.setItem('selectedISD', isdFilter);
	}

	function loadISDFromSession() {
		const storedISD = sessionStorage.getItem('selectedISD');
		if (storedISD) {
			isdFilter = storedISD;
		}
	}

	onMount(async () => {
		loadISDFromSession();
		await fetchClosures();
		const interval = setInterval(fetchClosures, 60000); // Refresh every 60 seconds
		return () => clearInterval(interval);
	});
</script>

<div class="filter-container mb-4">
	<select
		id="isd-selector"
		bind:value={isdFilter}
		on:change={saveISDToSession}
		class="p-2 rounded border bg-gray-800 text-white"
	>
		<option value="all">All ISDs</option>
		{#if closures && Object.keys(closures).length > 0}
			{#each getISDs() as isd}
				<option value={isd}>{isd}</option>
			{/each}
		{/if}
	</select>
</div>

{#if loading}
	<p class="mt-4 text-yellow-400">Loading data...</p>
{:else if error}
	<p class="mt-4 text-red-500">{error}</p>
{:else}
	<div id="closure-container" class="mt-8">
		{#each Object.entries(filteredClosures()) as [isd, counties]}
			<div class="isd-block mb-8">
				<h2 class="text-2xl font-bold">{isd}</h2>
				{#each Object.entries(counties) as [county, schools]}
					<div class="county-block ml-4 mb-4">
						<h3 class="text-xl font-semibold">{county}</h3>
						{#each Object.entries(schools) as [schoolName, data]}
							<div class="ml-8" class:data-closed={data.closed} class:data-open={!data.closed}>
								{schoolName}: {data.closed ? 'Closed' : 'Open'}
							</div>
						{/each}
					</div>
				{/each}
			</div>
		{/each}
	</div>
{/if}

<style>
	.bg-dark {
		background-color: #1f2022;
		color: white;
	}
	.text-yellow-400 {
		color: #fbbf24;
	}
	.text-red-500 {
		color: #ef4444;
	}
	.text-green-500 {
		color: #22c55e;
	}
	.filter-container {
		display: flex;
		flex-direction: column; /* Stacks children vertically on small screens */
		align-items: flex-start; /* Aligns children to the left */
		margin-bottom: 20px;
		width: 100%; /* Ensures the container spans the screen */
	}

	#isd-selector {
		width: 100%; /* Makes the select dropdown span the width of the container */
		max-width: 400px; /* Optional: Limits the maximum width for better appearance */
		background-color: #121212;
		border-color: #383838;
		color: white;
		padding: 0.5rem;
		border-radius: 5px;
		box-sizing: border-box; /* Includes padding and border in width calculation */
	}

	#isd-selector option {
		background-color: #121212;
		color: white;
	}

	.data-closed {
		color: #ef4444;
	}
	.data-open {
		color: #22c55e;
	}
	#closure-container {
		max-width: 900px;
		margin: 20px auto;
		padding: 20px;
		background-color: #1e1e1e;
		border-radius: 10px;
		box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.5);
	}
	h2 {
		font-size: 1.8rem;
		color: white;
	}
	h3 {
		font-size: 1.4rem;
		color: #dcdcdc;
	}
	p {
		font-size: 1rem;
		color: white;
	}
</style>
