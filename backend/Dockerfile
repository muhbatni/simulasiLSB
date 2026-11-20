# Multi-stage build Dockerfile untuk Backend NestJS
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner

RUN apk add --no-cache fontconfig ttf-dejavu

WORKDIR /app
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 5000

ENV PORT=5000
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/prisma/seed.js && node dist/main.js"]
