FROM node:lts-alpine

WORKDIR /app

COPY package.json package.json

RUN npm i --production

COPY index.js index.js

ENTRYPOINT ["node"]
CMD ["index.js"]



