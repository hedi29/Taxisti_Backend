# services/notification-service/Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY services/notification-service/package*.json ./services/notification-service/
COPY libs/common/package*.json ./libs/common/
COPY libs/models/package*.json ./libs/models/

RUN npm install --workspace=@yourride/notification-service

COPY services/notification-service ./services/notification-service
COPY libs/common ./libs/common
COPY libs/models ./libs/models

CMD ["node", "services/notification-service/index.js"]