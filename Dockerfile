FROM node:20-slim

RUN apt-get update \
 && apt-get install -y default-mysql-client \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE ${API_PORT:-3650}

CMD ["npm", "run", "start"]
