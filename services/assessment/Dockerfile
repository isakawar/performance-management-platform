FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
# NOTE: npm ci validates package-lock.json against every workspace listed in
# root package.json's "workspaces" array. When a new service/package is added,
# its directory must be copied here too, or this build will fail.
COPY packages/shared ./packages/shared
COPY services/gateway ./services/gateway
COPY services/auth ./services/auth
COPY services/assessment ./services/assessment
RUN npm ci
RUN npm run build --workspace=@pmp/shared
RUN npm run build --workspace=@pmp/assessment
RUN npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=node:node /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=node:node /app/services/assessment/dist ./services/assessment/dist
COPY --from=build --chown=node:node /app/services/assessment/package.json ./services/assessment/package.json
USER node
EXPOSE 3003
CMD ["node", "services/assessment/dist/main.js"]
