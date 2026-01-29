FROM node:18-bullseye

RUN apt-get update \
  && apt-get install -y python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY importer ./importer

RUN pip3 install --no-cache-dir -r importer/requirements.txt
RUN npm run build

RUN mkdir -p /app/incoming

EXPOSE 5055
CMD ["node", "dist/server.js"]
