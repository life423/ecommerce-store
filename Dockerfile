FROM node:24-slim AS development
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
RUN npm ci && chown -R node:node /app
COPY --chown=node:node . .
USER node

FROM development AS frontend
EXPOSE 5173
CMD ["npm", "run", "dev", "-w", "frontend", "--", "--host", "0.0.0.0"]

FROM development AS backend
EXPOSE 3000
CMD ["npm", "run", "dev", "-w", "backend"]
