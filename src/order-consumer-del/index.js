const k8s = require('@kubernetes/client-node');
const redis = require('redis')
const bluebird = require('bluebird')
bluebird.promisifyAll(redis);

const client = redis.createClient({ host: process.env.REDIS_HOST })

const kc = new k8s.KubeConfig()
kc.loadFromDefault()

const k8sApi = kc.makeApiClient(k8s.CustomObjectsApi)

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
  client.brpoplpush(process.env.DELETE_QUEUE_NAME, process.env.DELETE_PROCESSING_QUEUE_NAME, 0, (err, data) => {
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
        let tickets = available_tickets.map(ticket => ticket.metadata.name)

        return Promise
          .all(tickets.map(name => delete_ticket(metadata, name)))
          .then(_ => 0)
      })
      .then(_ => client.lremAsync(process.env.DELETE_PROCESSING_QUEUE_NAME, 0, key))
      .then(() => console.log(`Delete completed for order: ${id}`))
      .catch(err => console.error(err))
      .finally(() => {
        return setImmediate(() => get_from_queue(client))
      })
  })
})(client);

