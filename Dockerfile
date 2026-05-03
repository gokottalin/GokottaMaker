FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json ./
COPY . .

ENV NODE_ENV=production
ENV PORT=4173
ENV DATA_DIR=/data

EXPOSE 4173
CMD ["npm", "start"]
