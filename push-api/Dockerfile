FROM node:22-bookworm-slim
WORKDIR /app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY schema.sql ./
COPY migrations ./migrations
COPY src ./src

ENV PORT=4426
ENV SQLITE_PATH=/data/push.db
EXPOSE 4426
VOLUME ["/data"]

CMD ["node", "src/index.js"]
