# Node 20 LTS: richiesto da Express ^5.1.0 / Mongoose ^8.0.0
FROM node:20-slim

WORKDIR /app

# Copia solo i manifest prima del codice per sfruttare la cache dei layer Docker
# (npm ci gira di nuovo solo se package*.json cambia, non ad ogni modifica al codice)
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

# "npm start" esegue "node src/app.js" (produzione) e non "npm run dev" che è pensato solo per lo sviluppo locale fuori Docker.
CMD ["npm", "start"]