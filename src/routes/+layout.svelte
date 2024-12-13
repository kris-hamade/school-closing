<script>
	import Navbar from '$lib/Navbar.svelte';
</script>

<Navbar />

<main class="content">
	<slot />
</main>

<style>
	.content {
		background-color: #1f2022;
		min-height: 100vh;
		padding: 20px;
		color: white;
	}
</style>
