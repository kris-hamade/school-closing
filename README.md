# Michigan School Closures

SvelteKit frontend for Michigan school closure status, district search, and local weather.

## Local backend

During `npm run dev`, API requests automatically prefer a backend running at
`http://127.0.0.1:3023`. If it is not reachable within 1.2 seconds, the frontend
falls back to the production API at `https://snowday.hamy.app`.

Override the local address in `.env` when needed:

```env
LOCAL_CLOSURES_API_URL=http://127.0.0.1:3023/api/closures
```

The frontend response includes an `x-closures-upstream` header containing
`local` or `production`, which makes the selected backend easy to verify.

## Development

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```bash
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
