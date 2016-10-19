all: clean

build:
		rm -rf node_modules && npm install --production

build_docker: build
		docker build -t azweb76/kube-cluster-agent .

clean: build_docker

publish: clean
	  docker push azweb76/kube-cluster-agent
