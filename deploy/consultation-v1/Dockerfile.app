FROM node:24.19.0-bookworm-slim

ENV NODE_ENV=production
WORKDIR /srv/virgilio

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY app/auth-v1.mjs app/binary-store.mjs app/consultation-operational-logger.mjs ./app/
COPY app/consultation-store.mjs app/consultation-v1-api.mjs app/court-records-api.mjs ./app/
COPY app/file-gateway-v1.mjs app/pdf-evidence.mjs app/processing-common.mjs ./app/
COPY app/processing-comparison.mjs app/processing-registry.mjs app/processing-store.mjs ./app/
COPY app/reference-consultation-read.mjs app/reference-observation-api.mjs app/reference-search-store.mjs ./app/
COPY app/representation-artifacts.mjs app/text-consultation-mcp-server.mjs ./app/
COPY app/text-consultation-mcp-tools.mjs app/text-consultation-mcp-v1-http-server.mjs ./app/
COPY release/consultation-v1/contracts/openapi-v1.yaml ./release/consultation-v1/contracts/openapi-v1.yaml
COPY test/fixtures/reference-index-pilot.json ./test/fixtures/reference-index-pilot.json
COPY deploy/consultation-v1/read-secrets.sh /usr/local/bin/read-secrets

RUN chmod 0555 /usr/local/bin/read-secrets && chown -R node:node /srv/virgilio
USER node
ENTRYPOINT ["/usr/local/bin/read-secrets"]
