FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS push
WORKDIR /opt/push-api

RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*

COPY push-api/package.json push-api/package-lock.json* ./
RUN npm install --omit=dev

COPY push-api/schema.sql ./
COPY push-api/migrations ./migrations
COPY push-api/src ./src

FROM node:22-bookworm-slim
RUN apt-get update \
	&& apt-get install -y --no-install-recommends nginx \
	&& rm -rf /var/lib/apt/lists/* \
	&& rm -f /etc/nginx/sites-enabled/default

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/build /usr/share/nginx/html
COPY --from=push /opt/push-api /opt/push-api
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV HOST=127.0.0.1
ENV PORT=4426
ENV SQLITE_PATH=/data/push.db
ENV PUSH_SEND_ENABLED=true
ENV VAPID_SUBJECT=mailto:weather@localhost

EXPOSE 4425
VOLUME ["/data"]
CMD ["/entrypoint.sh"]
