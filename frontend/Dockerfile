# Stage 1: build
FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: test
FROM build AS test
RUN npm run test

# Stage 3: production
FROM nginx:alpine AS production
COPY --from=test /app/package.json /tmp/test-gate
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80