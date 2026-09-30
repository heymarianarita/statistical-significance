# Serves the pre-built static site (run `pnpm build` first).
# Built locally because @vinted/* packages come from the VPN-only registry.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist /usr/share/nginx/html
EXPOSE 3000
