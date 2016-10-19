from centos:7

WORKDIR /app

ENV NODE_VERSION v6.7.0

RUN \
  mkdir -p /usr/local/node/ && \
  cd /tmp && \
  curl -fqOL http://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-x64.tar.gz && \
  tar xzf node-$NODE_VERSION-linux-x64.tar.gz -C /usr/local/node/ && \
  rm -f node-$NODE_VERSION.tar.gz && \
  ln -s /usr/local/node/node-$NODE_VERSION-linux-x64/bin/node /usr/local/bin/node

COPY node_modules node_modules/
COPY bin bin/
COPY package.json ./
COPY lib lib/
