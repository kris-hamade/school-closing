<script>
	import packageInfo from '../../package.json';
	import { backendSource } from '$lib/store.js';

	$: connectionLabel =
		$backendSource === 'local'
			? 'Local backend'
			: $backendSource === 'production'
				? 'Production backend'
				: $backendSource === 'unavailable'
					? 'Backend unavailable'
					: 'Checking backend';
</script>

<footer class="site-footer">
	<div class="footer-inner">
		<span>Michigan School Closures</span>
		<span class="separator" aria-hidden="true">•</span>
		<span>Version {packageInfo.version}</span>
		<span class="separator" aria-hidden="true">•</span>
		<span
			class="connection"
			class:local={$backendSource === 'local'}
			class:offline={$backendSource === 'unavailable'}
		>
			<span class="status-dot" aria-hidden="true"></span>
			{connectionLabel}
		</span>
	</div>
</footer>

<style>
	.site-footer {
		border-top: 1px solid #223044;
		background: #0a1018;
		color: #8290a3;
	}

	.footer-inner {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.55rem;
		width: min(1100px, 100%);
		min-height: 58px;
		margin: 0 auto;
		padding: 0.85rem 1.25rem;
		font-size: 0.75rem;
	}

	.separator {
		color: #3b4b61;
	}

	.connection {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: #9eb5d1;
	}

	.status-dot {
		width: 7px;
		height: 7px;
		border-radius: 999px;
		background: #4d91df;
		box-shadow: 0 0 0 3px rgba(77, 145, 223, 0.12);
	}

	.connection.local {
		color: #70d9a1;
	}

	.connection.local .status-dot {
		background: #2ecc71;
		box-shadow: 0 0 0 3px rgba(46, 204, 113, 0.12);
	}

	.connection.offline {
		color: #f0a3a3;
	}

	.connection.offline .status-dot {
		background: #ef5b5b;
		box-shadow: 0 0 0 3px rgba(239, 91, 91, 0.12);
	}

	@media (max-width: 520px) {
		.footer-inner {
			flex-wrap: wrap;
			row-gap: 0.25rem;
		}
	}
</style>
