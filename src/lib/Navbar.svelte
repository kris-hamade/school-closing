<script>
	import { lastUpdated } from '$lib/store.js';
	import WeatherWidget from '$lib/WeatherWidget.svelte';
</script>

<nav class="site-header">
	<div class="nav-inner">
		<a href="/" class="brand" aria-label="Michigan School Closures home">
			<img src="/images/logo.png" alt="" class="navbar-logo" />
			<span>
				<strong>Michigan School Closures</strong>
				<small>Live district status dashboard</small>
			</span>
		</a>
		<div class="header-tools">
			<WeatherWidget />
			{#if $lastUpdated}
				<div class="last-updated" title="Most recent successful closure data update">
					<span class="status-dot"></span>
					<span><small>Closure data updated</small>{$lastUpdated}</span>
				</div>
			{/if}
		</div>
	</div>
</nav>

<style>
	.site-header {
		position: sticky;
		top: 0;
		z-index: 50;
		padding: 0.8rem 1.25rem;
		background: rgba(12, 18, 27, 0.92);
		border-bottom: 1px solid rgba(255, 255, 255, 0.09);
		backdrop-filter: blur(16px);
	}
	.nav-inner {
		max-width: 1180px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		color: #fff;
		text-decoration: none;
		min-width: max-content;
	}
	.navbar-logo {
		width: 54px;
		height: 54px;
		object-fit: contain;
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
	}
	.brand span {
		display: flex;
		flex-direction: column;
	}
	.brand strong {
		font-size: 1.08rem;
		letter-spacing: -0.01em;
	}
	.brand small {
		color: #8fa1b8;
		font-size: 0.7rem;
		margin-top: 0.12rem;
	}
	.header-tools {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.8rem;
	}
	.last-updated {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #d7e0ec;
		font-size: 0.72rem;
		line-height: 1.25;
		white-space: nowrap;
	}
	.last-updated > span:last-child {
		display: flex;
		flex-direction: column;
	}
	.last-updated small {
		color: #8292a8;
		font-size: 0.65rem;
	}
	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #45d483;
		box-shadow: 0 0 0 4px rgba(69, 212, 131, 0.12);
	}

	@media (max-width: 880px) {
		.nav-inner {
			align-items: flex-start;
		}
		.header-tools {
			flex-wrap: wrap;
		}
		.last-updated {
			display: none;
		}
	}
	@media (max-width: 700px) {
		.site-header {
			position: static;
			padding: 0.75rem;
		}
		.nav-inner {
			flex-direction: column;
			gap: 0.75rem;
		}
		.header-tools {
			width: 100%;
		}
		.navbar-logo {
			width: 44px;
			height: 44px;
		}
	}
</style>
