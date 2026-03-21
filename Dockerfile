FROM node:20-alpine

WORKDIR /app

COPY server/package*.json ./
RUN npm install

COPY server/ .
COPY public/ ./public/

EXPOSE 3008

CMD ["node", "index.js"]
