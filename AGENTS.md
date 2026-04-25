# Reality Scraper Agent Notes

## App Shape
- This repo is a TypeScript Node app that runs the scraper scheduler and Telegram bot from `src/index.ts`.
- Public web/API surfaces are served by the same PM2 process unless there is a clear reason to split them.
- The frontend is a Svelte/Vite app. Build output is served as static files by the Node app.
- The HTTP server reads `PORT` from the environment. Do not hardcode public ports in application code.

## Build And Test
- Use `npm run build` before deployment. It builds both the Svelte UI and TypeScript backend.
- Use `npm test` for the existing Vitest suite.
- `npm run build:ui` builds only the Svelte UI.
- `npm run dev:ui` starts the Vite UI dev server. Keep API calls same-origin or proxied during local frontend development.

## Hostinger VPS
- Hostinger SSH alias `hostinger` works for remote commands.
- Existing raw deploy target `root@72.62.145.103` may fail auth from automation; prefer the `hostinger` SSH alias when doing manual deploys.
- App path on the VPS: `/opt/reality-scraper`.
- PM2 app name: `reality-scraper`.
- Use a nonstandard public port per app/API when multiple apps share the VPS.
- The remote `.env` should define `PORT` and `NODE_ENV=production`.
- When changing env vars on the VPS, restart with `pm2 restart reality-scraper --update-env`.
- UFW was inactive during initial VPS work. If UFW is later enabled, explicitly allow the app's public TCP port.

## Manual Deploy Fallback
If `npm run deploy` fails SSH auth, this flow worked:

```bash
npm run build
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='.git' \
  --exclude='hostinger' \
  --exclude='hostinger.pub' \
  --exclude='src/__tests__' \
  -e ssh \
  ./ hostinger:/opt/reality-scraper/
ssh hostinger "cd /opt/reality-scraper && npm ci --omit=dev && pm2 restart reality-scraper --update-env"
```

## Svelte Notes
- This project uses Svelte 5. Instantiate the app with `mount`, not `new App(...)`.
- Correct `ui/src/main.ts` pattern:

```ts
import { mount } from "svelte";
import App from "./App.svelte";

const app = mount(App, {
  target: document.getElementById("app") as HTMLElement,
});

export default app;
```

- Using `new App({ target })` caused a white screen and browser console error: `Uncaught TypeError: can't access property "call", Vn is undefined`.

## Deployment Gotchas
- The deployed app must include the built frontend output, not just the source files.
- Serving the UI and API from the same origin avoids unnecessary CORS setup.
- Browser hard refresh may be needed after deployment because built JS asset names change.
- `npm install` / `npm ci` currently reports dependency audit warnings; do not run `npm audit fix` as part of unrelated work because it may introduce broad dependency churn.
