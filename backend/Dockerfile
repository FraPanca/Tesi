# Stage 1: build
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Stage 2: test
FROM build AS test
RUN npm run test

# Stage 3: production
FROM node:20-slim AS production
WORKDIR /app
COPY --from=test /app/package.json /tmp/test-gate
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["npm", "start"]