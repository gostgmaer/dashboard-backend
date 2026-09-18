# Dockerfile for dashboard-backend
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3500

COPY . .

EXPOSE 3500
CMD ["node", "server.js"]
