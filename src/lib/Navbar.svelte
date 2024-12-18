<script>
  import { lastUpdated } from '$lib/store.js';
</script>

<nav class="navbar navbar-expand-lg navbar-dark bg-dark">
  <div class="container-fluid">
    <img src="/images/logo.png" alt="Logo" class="navbar-logo" style="width: 5em; height: 5em;">
    <a class="navbar-brand" href="/">Michigan School Closures</a>
    {#if $lastUpdated}
      <div class="last-updated">
        Last Updated: {$lastUpdated}
      </div>
    {/if}
  </div>
</nav>

<style>
.navbar {
  padding: 10px 20px;
  border-bottom: 1px solid #383838;
}

.navbar-brand {
  font-size: 1.5rem;
  color: #ffffff;
  text-decoration: none;
}

.last-updated {
  font-size: 0.875rem;
  color: #d1d5db;
  margin-left: auto;
}
</style>
