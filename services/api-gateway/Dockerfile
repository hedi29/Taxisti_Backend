# services/api-gateway/Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY services/api-gateway/package*.json ./services/api-gateway/
COPY libs/common/package*.json ./libs/common/
COPY libs/middleware/package*.json ./libs/middleware/

RUN npm install --workspace=@yourride/api-gateway

COPY services/api-gateway ./services/api-gateway
COPY libs/common ./libs/common
COPY libs/middleware ./libs/middleware

CMD ["node", "services/api-gateway/index.js"]