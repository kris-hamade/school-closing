<script>
  import { lastUpdated } from '$lib/store.js';
</script>

<nav class="navbar navbar-expand-lg navbar-dark bg-dark">
  <div class="container-fluid">
    <img src="/images/logo.png" alt="Logo" class="navbar-logo" style="width: 5em; height: 5em;">
    <a class="navbar-brand" href="/">Michigan School Closures</a>
    {#if $lastUpdated}
      <div class="last-updated">
        <span class="last-updated-label">Last pulled from source:</span>
        <span class="last-updated-time">{$lastUpdated}</span>
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
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}

.last-updated-label {
  font-size: 0.75rem;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.last-updated-time {
  font-weight: 500;
  color: #d1d5db;
}

@media (max-width: 768px) {
  .last-updated {
    font-size: 0.75rem;
  }
  
  .last-updated-label {
    font-size: 0.7rem;
  }
}
</style>
