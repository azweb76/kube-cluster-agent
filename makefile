VERSION := $(shell cat ./package.json | jq -r .version)

all: clean

build:
		rm -rf node_modules && yarn install --production

build_docker: build
		docker build -t azweb76/kube-cluster-agent:$(VERSION) .

clean: build_docker

publish:
	  docker tag azweb76/kube-cluster-agent:$(VERSION) azweb76/kube-cluster-agent:latest
		docker push azweb76/kube-cluster-agent:$(VERSION)
	  docker push azweb76/kube-cluster-agent:latest
