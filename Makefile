node_port := $(shell kubectl get service -n ingress-nginx ingress-nginx -o=jsonpath="{.spec.ports[?(@.port == 80)].nodePort}")

clean:
	docker kill kind-proxy-80 | true
	docker rm kind-proxy-80 | true

dev: clean
	docker run -d --name kind-proxy-80 \
		--publish 127.0.0.1:80:80 \
		--link kind-control-plane:target \
		alpine/socat -dd \
		tcp-listen:80,fork,reuseaddr tcp-connect:target:${node_port}
