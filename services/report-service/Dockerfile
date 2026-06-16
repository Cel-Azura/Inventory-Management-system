FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache wget
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3004
CMD ["node", "src/server.js"]