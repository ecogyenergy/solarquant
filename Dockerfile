FROM node:19
WORKDIR /usr/src/solarquant
COPY package*.json ./

RUN npm install

RUN apt update && apt install podman -y

COPY . .
RUN node_modules/typescript/bin/tsc
RUN npm install -g .

ENTRYPOINT ["sqc"]
