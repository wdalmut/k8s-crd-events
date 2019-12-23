FROM node:lts-alpine

WORKDIR /app

COPY orders-validate-service.kconference.svc.key orders-validate-service.kconference.svc.key
COPY orders-validate-service.kconference.svc.crt orders-validate-service.kconference.svc.crt
COPY package.json package.json

RUN npm i --production

COPY index.js index.js

ENTRYPOINT ["node"]
CMD ["index.js"]



