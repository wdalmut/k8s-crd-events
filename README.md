# Create an application using K8S resources

Manage a conference application with K8S build blocks (PoC).

Everything starts with a `Conference` custom resource definition. When a new
conference is created or updated/delete a shared informer push the event in a
message queue where a controller deploy a dedicated K8S namespace with the
application deploy.

## Getting started

Create the cluster

```sh
kind create cluster --config kind.yaml
```

Start development

```sh
skaffold dev
```

Check existing conferences

```sh
kubectl get conferences
No resources found in default namespace.
```

Now create a new conference

```sh
kubectl apply -f examples/cloudconf2020.yaml
```

Check existing conferences

```sh
kubectl get conferences
NAME            TITLE            ON DAY
cloudconf2020   CloudConf 2020   2020-03-19

```

Check also the dedicated namespace!

```sh
kubectl describe ns cloudconf2020
Name:         cloudconf2020
Labels:       <none>
Annotations:  <none>
Status:       Active

No resource quota.

No resource limits.
```

