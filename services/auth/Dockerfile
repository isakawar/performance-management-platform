FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
# NOTE: npm ci validates package-lock.json against every workspace listed in
# root package.json's "workspaces" array. When a new service/package is added,
# its directory must be copied here too, or this build will fail.
COPY packages/shared ./packages/shared
COPY services/gateway ./services/gateway
COPY services/auth ./services/auth
RUN npm ci
RUN npm run build --workspace=@pmp/shared
RUN npm run build --workspace=@pmp/auth
RUN npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=node:node /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=node:node /app/services/auth/dist ./services/auth/dist
COPY --from=build --chown=node:node /app/services/auth/package.json ./services/auth/package.json
USER node
EXPOSE 3001
CMD ["node", "services/auth/dist/main.js"]
