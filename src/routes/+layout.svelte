<script>
	import Navbar from '$lib/Navbar.svelte';
</script>

<Navbar />

<main class="content">
	<slot />
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}

	:global(html) {
		background: #0d131c;
	}

	:global(body) {
		margin: 0;
		background: #0d131c;
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
	}

	.content {
		background:
			radial-gradient(circle at 15% 0%, rgba(45, 112, 190, 0.13), transparent 32rem), #0d131c;
		min-height: 100vh;
		padding: 2rem 1.25rem 4rem;
		color: white;
	}

	@media (max-width: 600px) {
		.content {
			padding: 1.25rem 0.75rem 3rem;
		}
	}
</style>
