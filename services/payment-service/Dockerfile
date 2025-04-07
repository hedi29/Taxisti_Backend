# services/payment-service/Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY services/payment-service/package*.json ./services/payment-service/
COPY libs/common/package*.json ./libs/common/
COPY libs/models/package*.json ./libs/models/

RUN npm install --workspace=@yourride/payment-service

COPY services/payment-service ./services/payment-service
COPY libs/common ./libs/common
COPY libs/models ./libs/models

CMD ["node", "services/payment-service/index.js"]