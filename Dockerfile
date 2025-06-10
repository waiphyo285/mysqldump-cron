FROM node:20-alpine-slim

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE ${API_PORT:-3650}

CMD ["npm", "run", "start"]