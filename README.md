# Create an application using K8S resources

Manage a conference application with K8S build blocks (PoC).

Everything starts with a `Conference` custom resource definition. When a new
conference is created or updated/delete a shared informer push the event in a
message queue where a controller deploy a dedicated K8S namespace with the
application deploy.

 > Road to CloudConf2020? Check it out: https://cloudconf.it

## Getting started

Create the cluster

```sh
kind create cluster --config kind.yaml
```

Start development

```sh
skaffold run
```

## Play with conferences!

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

Now create a conference purchase plan

```sh
kubectl apply -f examples/cloudconf2020-plan.yaml
```

And get the created plan

```sh
kubectl get plan -n cloudconf2020
NAME               TITLE                     ACTIVE   PRICE
super-early-bird   Super Early Bird Ticket   true     29.9
```

Then create an order

```sh
kubectl apply -f examples/cloudconf2020-order-1.yaml
```

Then check the created order

```sh
kubectl get orders -n cloudconf2020
NAME      PLAN               COUPON   STATUS    CURRENT   DESIRED   PRICE   DATE
order-1   super-early-bird            PENDING   0         1         29.9    357d
```

The order is correctly created but there are not tickets because its status is
"PENDING"

```sh
kubectl get tickets -n cloudconf2020
No resources found in cloudconf2020 namespace.
```

Tickets will be generated only where the order status is confirmed, to confirm
the order you can pay for it (receiving the payment webhook), have a free plan
or the Coupon value is high enough to set a free ticket (price=0)

## Ticket creation

Generate a free event

```sh
cat <<EOF > meetup.yaml
apiVersion: "app.corley.it/v1"
kind: Conference
metadata:
  name: meetup
spec:
  title: "Free Meetup"
EOF
kubectl apply -f meetup.yaml
```

Then a free plan

```sh
cat <<EOF > plan.yaml
apiVersion: "app.corley.it/v1"
kind: Plan
metadata:
  name: free-plan
  namespace: meetup
spec:
  title: "Free Ticket"
  price: 0
  active: true
EOF
kubectl apply -f plan.yaml
```

Now create an order

```sh
cat <<EOF > order.yaml
apiVersion: "app.corley.it/v1"
kind: Order
metadata:
  name: order-1
  namespace: meetup
spec:
  planRef: free-plan
  price: 0
  date: "2019-01-01T08:00:00Z"
  quantity: 1
EOF
kubectl apply -f order.yaml
```

Becase the order price is 0 (free event in this case) the ticket generation is
completely automated. Just get tickets for this order

```
kubectl get tickets -n meetup
NAME              ORDER     FIRSTNAME   LASTNAME
order-1-5193329   order-1
```

You can "scale" the order and get multiple tickets. Check this out:

```sh
kubectl scale order --replicas=6 --namespace meetup order-1
```

Then check your tickets

```sh
kubectl get tickets -n meetup
NAME              ORDER     FIRSTNAME   LASTNAME
order-1-2729627   order-1
order-1-3468125   order-1
order-1-3598565   order-1
order-1-5193329   order-1
order-1-9476971   order-1
order-1-9926811   order-1
```

## Pay for a ticket

Just receive the payment event (POST call on the payment gateway)

```sh
curl -XPOST -d 'custom=order-1&payment_status=Completed&mc_gross=29.90&mc_currency=EUR' http://localhost/payment-gateway/cloudconf2020
```

If you check the order event list now you will see the payment confirmation
event and then the tickets will be created.

## Delete a conference

If you want to drop out everything about a conference, just drop the
`conference` element

```sh
kubectl delete conference CloudConf2020
```

And checkout your namespaces:

```sh
NAME              STATUS        AGE
cloudconf2020     Terminating   15m
default           Active        43m
ingress-nginx     Active        32m
kconference       Active        19m
kube-node-lease   Active        43m
kube-public       Active        43m
kube-system       Active        43m
```

As you see the namespace is now in `Terminating` and soon everything will be
removed!

## Expose nginx ingress (for KinD)

Deploy nginx ingress

```sh
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/master/deploy/static/mandatory.yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/master/deploy/static/provider/baremetal/service-nodeport.yaml
```

Then expose the service with socat

```sh
make dev
```

