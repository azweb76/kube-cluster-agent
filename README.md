# Kubernetes Cluster Agent
Used to monitor a kubernetes cluster/namespaces and handle replication controller retention.

sample: [rc.yaml](docs/samples/rc.yaml)

## Usage

```bash
/app/bin/start \
 --url=http://kube.mydomain.com:8080 \
 --retention-interval=5m \
 --monitor-interval=30s \
 --slack-url=https://hooks.slack.com/services/xxx/xxx/xxx \
 --notify-user=@here \
 --slack-channel=kube-monitor \
 --namespace=default
```

|argument|description|
|---|---|
|-u, --url|Url to the kubernetes cluster.|
|-ns, --namespace|Namespace to monitor.|
|-m, --monitor|Monitors to enable. Can be used multiple times.|
|--slack-url|Url to send Slack messages.|
|--notify-user|Default `@here`. Slack user to notify.|
|--username|Username used to login to cluster.|
|--password|Password used to login to cluster.|
|--token|Token used to login to cluster.|
|--token-file|Token file used to login to cluster.|
|--ca-file|CA certificate used to access cluster.|
|--cert|Client certificate used to login to cluster.|
|--key|Client certificate key used to login to cluster.|
|--pod-threshold|Maximum pods in the namespace. Used when privileged is disabled.|
|--cluster-name|Name of the cluster used in notifications.|
|-p, --parallelism|Default 4. Number of parallel tasks.|
|--pod-availability-threshold|Default 10. Minimum available pods threshold.|
|--monitor-interval|Default 1m. Interval to run monitor checks.|
|--max-pod-pending|Default 5m. Maximum duration a pod can be in a pending status.|
|--privileged|Default false. Enable cluster-wide features.|
|--max-pod-restarts|Default 2. Maximum number a pod can restart within the monitor-interval.|
|--retention-interval|Default 5m. The interval in which the retention process checks for expired builds.|
|--audit-interval|Default 5d. The interval in which the retention process should audit objects (orphaned, etc).|

## Monitoring
The monitors are invoked based on `--monitor-interval` and if a monitor fails 3 or more times, an alert is created and a Slack or console message is sent.

|monitor|description|
|---|---|
|capacity|Check if the number of pods in each namespace exceed the cluster or `--pod-capacity` limit.|
|nodes|Privileged. Check if all nodes are in a Ready state.|
|pods|Check if all pods are in a Ready state.|

The agent listens on port 8080 and exposes the health of the service using a `/healthcheck.html` route.

## Retention
Used to delete objects that expire based on a pin date (`pinned_dt` annotation) in each replication controller. When the pin date expires, ingress, service and replication controller objects will be deleted based on all objects sharing the same name.
