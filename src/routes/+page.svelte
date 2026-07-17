<script>
	import Closures from '$lib/Closures.svelte';

	let isdFilter = 'all';
</script>

<div class="page-shell">
	<header class="page-intro">
		<p class="eyebrow">Michigan district status</p>
		<h1>Know before you go.</h1>
		<p>Search your school or browse live closure reports by intermediate school district.</p>
	</header>
	<Closures bind:isdFilter />
</div>

<style>
	.page-shell {
		width: 100%;
		max-width: 1120px;
		margin: 0 auto;
	}
	.page-intro {
		margin: 0.5rem 0 1.6rem;
	}
	.eyebrow {
		margin: 0 0 0.35rem;
		color: #75b7ff;
		font-size: 0.72rem;
		font-weight: 750;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0;
		color: #f7faff;
		font-size: clamp(2rem, 5vw, 3.35rem);
		line-height: 1.05;
		letter-spacing: -0.045em;
	}
	.page-intro > p:last-child {
		max-width: 650px;
		margin: 0.7rem 0 0;
		color: #9eacc0;
		font-size: 1rem;
	}
</style>
