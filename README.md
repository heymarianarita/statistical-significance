# Prototype Test Planner

A statistical significance calculator for AI prototype generation tests. It works out how many generations to run before you trust the result, and checks results you already have.

Four modes:
- **Pass rate:** runs needed to measure one setup's pass rate within a margin of error.
- **A vs B:** runs per setup needed to detect a difference between two setups (two-proportion power calculation).
- **Rare failures:** clean runs in a row needed to show the failure rate is below a threshold.
- **Check results:** p-value and confidence intervals for observed pass counts.

Built with Vite, React and [`@vinted/web-ui`](https://github.com/vinted/web-ui) (Vinted theme).

## Run it

`@vinted/*` packages come from Vinted's private registry, so you need the VPN on.

```bash
pnpm install
pnpm dev
```

`pnpm build` writes a static site to `dist/`.

## Deploy to Playground

Playground can't reach the VPN-only `@vinted` registry, so build locally and upload a zip that nginx serves:

```bash
pnpm build
zip -rq ../statistical-significance-playground.zip Dockerfile nginx.conf dist -x "*.DS_Store"
```
