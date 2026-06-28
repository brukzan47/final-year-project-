FROM node:20-alpine

WORKDIR /usr/src/app

COPY . .

RUN if [ -f package.json ]; then \
      npm ci --omit=dev || npm install --omit=dev; \
    else \
      cd backend && (npm ci --omit=dev || npm install --omit=dev); \
    fi

EXPOSE 5000

CMD ["sh", "-c", "if [ -d backend ]; then cd backend; fi; node server.js"]
