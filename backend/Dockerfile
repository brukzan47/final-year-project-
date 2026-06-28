FROM node:20-alpine

WORKDIR /usr/src/app

# Install dependencies first
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy app source
COPY . .

# Expose API port
EXPOSE 5000

# Run the server
CMD ["node", "server.js"]

