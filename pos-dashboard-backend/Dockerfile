FROM node:22-bookworm-slim

RUN apt-get update   && apt-get install -y --no-install-recommends     python3 python3-pip python3-venv     build-essential     libpq-dev   && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install
# Ensure dotenv exists for runtime
RUN npm install dotenv

# Create venv for importer deps (PEP 668-safe)
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:/home/alphahs2/.local/bin:/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games"
RUN pip install --no-cache-dir     pandas     psycopg2-binary     openpyxl     xlrd     beautifulsoup4     lxml     html5lib

COPY . ./

ENV PORT=5057     POS_IMPORT_PYTHON=/opt/venv/bin/python
EXPOSE 5057

CMD ["npm", "run", "dev"]
