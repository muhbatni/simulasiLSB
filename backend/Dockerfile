# Multi-stage build Dockerfile untuk Backend NestJS (Proposal 3.1.4.3)
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 5000

ENV PORT=5000
CMD ["node", "dist/main.js"]
