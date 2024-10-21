#prod
FROM node:20.18.0-alpine AS builder
WORKDIR /app
COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

FROM node:20.18.0-alpine AS production
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

EXPOSE 3000

CMD ["npm", "run", "start:prod"]

# dev

FROM node:20.18.0-alpine AS development
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
