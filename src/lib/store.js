import { writable } from 'svelte/store';

export const lastUpdated = writable(null);
export const locationContext = writable({ status: 'idle', county: null, city: null });
