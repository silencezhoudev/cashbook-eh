FROM node:20-alpine3.21 AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npx prisma generate 
RUN npm run build

FROM node:20-alpine3.21 AS runner

ARG APP_VERSION="1.3.12"

LABEL author.name="silencezhoudev"
LABEL author.email="silencezhoudev@outlook.com"
LABEL project.name="CashBook-EH"
LABEL project.version="${APP_VERSION}"

WORKDIR /app

COPY --from=builder /app/.output/ ./ 
COPY ./prisma/ ./prisma/

COPY --from=builder /app/package*.json ./

RUN npm ci --only=production && \
    npm cache clean --force

COPY ./docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

RUN npm install -g prisma@6.16.2

ENV NUXT_APP_VERSION="${APP_VERSION}"
ENV NUXT_DATA_PATH="/app/data"
ENV PORT="9090"

VOLUME /app/data/

EXPOSE 9090

ENTRYPOINT ["/app/entrypoint.sh"]

