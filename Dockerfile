FROM gcr.io/distroless/nodejs

WORKDIR /app

COPY node_modules node_modules/
COPY package.json cli.js ./
COPY lib lib/

#USER scratchuser