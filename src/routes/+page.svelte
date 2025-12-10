<script>
  import Closures from '$lib/Closures.svelte';

  let isdFilter = 'Oakland Schools';
</script>

<div class="container mx-auto p-4 text-white bg-dark">
  <Closures bind:isdFilter />
</div>