# HS Code Workspace

## Local Development

```bash
npm install
npm run dev
```

Local address:

- `http://localhost:5173`

## Build

```bash
npm run build
```

Build output:

- `dist/`

## Deploy to `hc.szzmg.com`

Target folder on server:

- `/www/wwwroot/hc.szzmg.com`

Upload the **contents inside** `dist/` into `/www/wwwroot/hc.szzmg.com` (not nested as `/dist`).

## Run Local + Server Together

This project uses WebOC proxy paths in frontend URLs, such as:

- `/weboc/Shared/TariffList.aspx`
- `/weboc/DownloadValuationData.aspx`
- `/weboc/Shared/ItemGeneralDutyCalculator.aspx`

How both environments work:

- Local: Vite dev server proxy in `vite.config.ts`
- Server: Nginx reverse proxy (production)

So one codebase works in both places.

## Nginx (Production)

Use the provided template:

- `deploy/nginx.hc.szzmg.com.conf`

Important:

- Keep SPA fallback `try_files ... /index.html`
- Keep `/weboc` and `/weboc-www` proxy routes
- Reload Nginx after updating config

## Deploy on Railway (with iframe proxy)

This repository now includes a `Dockerfile` for Railway:

- Build frontend with Node 22
- Serve SPA via Nginx
- Proxy `/weboc` and `/weboc-www` to WebOC upstream

Key files:

- `Dockerfile`
- `deploy/nginx.railway.template.conf`

How to deploy:

1. Push to GitHub.
2. In Railway, redeploy the service (it will detect `Dockerfile` and use Docker deployment).
3. Keep the default `PORT` environment variable from Railway.

After this, production should behave like local proxy mode for iframe routes.
