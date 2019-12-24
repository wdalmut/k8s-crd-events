const k8s = require('@kubernetes/client-node');
const redis = require('redis')
const bluebird = require('bluebird')
bluebird.promisifyAll(redis);

const client = redis.createClient({ host: process.env.REDIS_HOST })

const kc = new k8s.KubeConfig()
kc.loadFromDefault()

const k8sApi = kc.makeApiClient(k8s.CustomObjectsApi)

const patch_quantity = ({namespace, name}, quantity) => {
  return k8sApi.patchNamespacedCustomObjectStatus(
    "app.corley.it",
    "v1",
    namespace,
    "orders",
    name,
    [
      { "op": "replace", "path": "/status/quantity", "value": quantity },
    ],
    {
      headers: {
        "content-type": "application/json-patch+json"
      }
    }
  )
}

const create_ticket = ({name, namespace}, {labelSelector}) => {
  return k8sApi.createNamespacedCustomObject(
    "app.corley.it",
    "v1",
    namespace,
    "tickets",
    {
      apiVersion: 'app.corley.it/v1',
      kind: 'Ticket',
      metadata: {
        name: `${labelSelector}-${(Math.random()*1e9*1e9).toString().slice(0,7)}`,
        labels: {
          "orders.app.corley.it": labelSelector,
        }
      },
      spec: {
        orderRef: name
      }
    }
  )
}

;(function get_from_queue(client) {
  client.brpoplpush(process.env.UPDATE_QUEUE_NAME, process.env.UPDATE_PROCESSING_QUEUE_NAME, 0, (err, data) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }

    const key = data

    data = JSON.parse(data)

    let metadata = data.metadata

    let id = metadata.name

    let status = data.status

    data = data.spec

    Promise.resolve(null)
      .then(() => {
        if (status.payment === 'CONFIRMED') {
          // create tickets
          return Promise.all(Array.apply(null, new Array(data.quantity)).map(_ => create_ticket(metadata, status)))
        } else {
          // delete tickets
          return []
        }
      })
      .then(quantity => patch_quantity(metadata, quantity.length))
      .then(_ => client.lremAsync(process.env.UPDATE_PROCESSING_QUEUE_NAME, 0, key))
      .then(() => console.log(`Setup completed for order: ${id}`))
      .catch(err => console.error(err))
      .finally(() => {
        return setImmediate(() => get_from_queue(client))
      })
  })
})(client);

