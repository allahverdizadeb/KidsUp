# ---- build: type-check and bundle ------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- serve: unprivileged nginx (non-root, port 8080) --------------------------
FROM nginxinc/nginx-unprivileged:stable-alpine
# Pick up security fixes the base image has not shipped yet, then go back to the unprivileged user.
USER root
RUN apk upgrade --no-cache
USER 101
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY nginx/csp-page.conf /etc/nginx/snippets/csp-page.conf
COPY nginx/csp-api.conf /etc/nginx/snippets/csp-api.conf
COPY nginx/real-ip.conf /etc/nginx/snippets/real-ip.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
