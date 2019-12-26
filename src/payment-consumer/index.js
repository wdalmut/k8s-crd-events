const k8s = require('@kubernetes/client-node');
const redis = require('redis')
const bluebird = require('bluebird')
bluebird.promisifyAll(redis);

const client = redis.createClient({ host: process.env.REDIS_HOST })

const kc = new k8s.KubeConfig()
kc.loadFromDefault()

const k8sApi = kc.makeApiClient(k8s.CustomObjectsApi)

const create_status_section = ({name, resourceVersion, namespace}) => {
  return k8sApi.replaceNamespacedCustomObjectStatus(
    "app.corley.it",
    "v1",
    namespace,
    "orders",
    name,
    {
      apiVersion: 'app.corley.it/v1',
      kind: "Order",
      metadata: {
        name,
        resourceVersion,
      },
      status: {
        payment: "PENDING",
        quantity: 0,
        labelSelector: name
      }
    },
  )
}

;(function get_from_queue(client) {
  client.brpoplpush(process.env.ADD_QUEUE_NAME, process.env.ADD_PROCESSING_QUEUE_NAME, 0, (err, data) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }

    const key = data

    data = JSON.parse(data)

    let metadata = data.metadata

    let id = metadata.name
    data = data.spec

    create_status_section(metadata)
      .then(_ => client.lremAsync(process.env.ADD_PROCESSING_QUEUE_NAME, 0, key))
      .then(() => console.log(`Setup completed for order: ${id}`))
      .catch(err => console.error(err))
      .finally(() => {
        return setImmediate(() => get_from_queue(client))
      })
  })
})(client);

