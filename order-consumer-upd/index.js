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

const list_tickets_per_order = ({ name, namespace }) => {
  return k8sApi.listNamespacedCustomObject(
    "app.corley.it",
    "v1",
    namespace,
    "tickets",
    undefined,
    undefined,
    {
      "orders.app.corley.it": name
    }
  )
}

const delete_ticket = ({ name, namespace }, ticket_name) => {
  return k8sApi.deleteNamespacedCustomObject(
    "app.corley.it",
    "v1",
    namespace,
    "tickets",
    ticket_name,
    {}
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

    list_tickets_per_order(metadata)
      .then(tickets => tickets.body.items)
      .then((available_tickets) => {
        let quantity = data.quantity - available_tickets.length

        if (status.payment === 'CONFIRMED' && quantity === 0) {
          return Promise
            .resolve([])
            .then(_ => data.quantity)
        } else if (status.payment === 'CONFIRMED' && quantity > 0) {
          return Promise
            .all(Array.apply(null, new Array(quantity)).map(_ => create_ticket(metadata, status)))
            .then(_ => data.quantity)
        } else if (status.payment === 'CONFIRMED' && quantity < 0) {
          let tickets = available_tickets.slice(quantity).map(ticket => ticket.metadata.name)

          return Promise
            .all(tickets.map(name => delete_ticket(metadata, name)))
            .then(_ => data.quantity)
        } else {
          let tickets = available_tickets.map(ticket => ticket.metadata.name)

          return Promise
            .all(tickets.map(name => delete_ticket(metadata, name)))
            .then(_ => 0)
        }
      })
      .then(quantity => patch_quantity(metadata, quantity))
      .then(_ => client.lremAsync(process.env.UPDATE_PROCESSING_QUEUE_NAME, 0, key))
      .then(() => console.log(`Setup completed for order: ${id}`))
      .catch(err => console.error(err))
      .finally(() => {
        return setImmediate(() => get_from_queue(client))
      })
  })
})(client);

