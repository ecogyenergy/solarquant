FROM node:19
WORKDIR /usr/src/solarquant
COPY package*.json ./

RUN npm install

COPY . .
RUN node_modules/typescript/bin/tsc
RUN npm install -g .
