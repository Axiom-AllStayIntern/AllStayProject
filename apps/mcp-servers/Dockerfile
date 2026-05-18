FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared ./packages/shared
ARG SERVICE
COPY packages/${SERVICE} ./packages/${SERVICE}
RUN npm install
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/${SERVICE}

FROM node:20-alpine
WORKDIR /app
ARG SERVICE
ENV SERVICE=${SERVICE}
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/${SERVICE}/dist ./packages/${SERVICE}/dist
COPY --from=builder /app/packages/${SERVICE}/package.json ./packages/${SERVICE}/
CMD ["node", "packages/${SERVICE}/dist/index.js"]
