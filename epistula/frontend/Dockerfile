# Epistula Frontend Dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install

FROM node:18-alpine AS builder
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# BACKEND_URL can be overridden at runtime
ARG BACKEND_URL=http://localhost:8000
ENV BACKEND_URL=${BACKEND_URL}
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
# Use npm start and pass args to `next start`
CMD ["npm", "start", "--", "-p", "3000"]
