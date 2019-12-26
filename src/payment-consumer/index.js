const k8s = require('@kubernetes/client-node');
const redis = require('redis')
const bluebird = require('bluebird')
bluebird.promisifyAll(redis);

const client = redis.createClient({ host: process.env.REDIS_HOST })

const kc = new k8s.KubeConfig()
kc.loadFromDefault()

const k8sApi = kc.makeApiClient(k8s.CustomObjectsApi)

const set_as_confirmed = ({name, namespace}, regarding) => {
  console.log(regarding.name)
  return k8sApi.patchNamespacedCustomObjectStatus(
    "app.corley.it",
    "v1",
    namespace,
    "orders",
    regarding.name,
    [
      { "op": "replace", "path": "/status/payment", "value": "CONFIRMED" },
    ],
    {
      headers: {
        "content-type": "application/json-patch+json"
      }
    }
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
    let regarding = data.regarding

    set_as_confirmed(metadata, regarding)
      .then(_ => client.lremAsync(process.env.ADD_PROCESSING_QUEUE_NAME, 0, key))
      .then(() => console.log(`Setup completed for order: ${id}`))
      .catch(err => console.error(err))
      .finally(() => {
        return setImmediate(() => get_from_queue(client))
      })
  })
})(client);

