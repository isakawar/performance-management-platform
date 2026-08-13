FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web ./apps/web
RUN npm ci
ARG NEXT_PUBLIC_GATEWAY_URL=http://localhost:3000
ENV NEXT_PUBLIC_GATEWAY_URL=${NEXT_PUBLIC_GATEWAY_URL}
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
RUN npm run build --workspace=@pmp/web
RUN npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/web/.next ./apps/web/.next
COPY --from=build --chown=node:node /app/apps/web/package.json ./apps/web/package.json
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
WORKDIR /app/apps/web
EXPOSE 3010
CMD ["npx", "next", "start", "-p", "3010"]
