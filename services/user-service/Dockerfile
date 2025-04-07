# services/user-service/Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY services/user-service/package*.json ./services/user-service/
COPY libs/common/package*.json ./libs/common/
COPY libs/models/package*.json ./libs/models/

RUN npm install --workspace=@yourride/user-service

COPY services/user-service ./services/user-service
COPY libs/common ./libs/common
COPY libs/models ./libs/models

CMD ["node", "services/user-service/index.js"]