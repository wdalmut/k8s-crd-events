const fs = require('fs')
const express = require('express')
const bodyParser = require('body-parser')
const k8s = require('@kubernetes/client-node');

const port = process.env.PORT || 3000

const namespace = fs.readFileSync("/var/run/secrets/kubernetes.io/serviceaccount/namespace").toString()

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const eventApi = kc.makeApiClient(k8s.EventsV1beta1Api);
const customApi = kc.makeApiClient(k8s.CustomObjectsApi);

const app = express()

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

const create_event = (namespace, {uid, name}) => {
  return eventApi.createNamespacedEvent(namespace, {
    count: 1,
    deprecatedFirstTimestamp: new Date(),
    kind: "Event",
    regarding: {
      apiVersion: "app.corley.it/v1",
      kind: "Order",
      name,
      namespace,
      uid,
    },
    note: "Payment confirmed via Paypal!",
    metadata: {
      name: `payment-${new String(Math.random()*1e9*1e9).slice(0,9)}.${new String(Math.random()*1e9*1e9).slice(0,9)}`,
      namespace,
      labels: {
        "payment-gateway.app.corley.it": "PAYPAL"
      }
    },
    reason: "PaymentConfirmed",
    reportingController: "payment-gateway",
    reportingInstance: "payment-gateway",
    type: "Normal",
    action: "Accepted",
    deprecatedSource: {
      component: "payment-gateway",
    }
  })
}

const get_order = (namespace, name) => {
  return customApi.getNamespacedCustomObject("app.corley.it", "v1", namespace, "orders", name)
}

app.post('/payment-gateway/:namespace', (req, res) => {
  get_order(namespace, req.body.custom)
    .then(order => {
      // TODO validate payment against the given order!

      return order
    })
    .then(order => {
      return create_event(namespace, order.body.metadata)
    })
    .then(() => {
      return res.send("OK").status(202)
    })
    .catch((err) => {
      return res.json(err).status(500)
    })
})

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
