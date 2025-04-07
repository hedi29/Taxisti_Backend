# services/location-service/Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY services/location-service/package*.json ./services/location-service/
COPY libs/common/package*.json ./libs/common/
COPY libs/models/package*.json ./libs/models/

RUN npm install --workspace=@yourride/location-service

COPY services/location-service ./services/location-service
COPY libs/common ./libs/common
COPY libs/models ./libs/models

CMD ["node", "services/location-service/index.js"]