# services/ride-service/Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY services/ride-service/package*.json ./services/ride-service/
COPY libs/common/package*.json ./libs/common/
COPY libs/models/package*.json ./libs/models/

RUN npm install --workspace=@yourride/ride-service

COPY services/ride-service ./services/ride-service
COPY libs/common ./libs/common
COPY libs/models ./libs/models

CMD ["node", "services/ride-service/index.js"]