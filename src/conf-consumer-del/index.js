const k8s = require('@kubernetes/client-node');
const redis = require('redis')
const bluebird = require('bluebird')
bluebird.promisifyAll(redis);

const client = redis.createClient({ host: process.env.REDIS_HOST })

const kc = new k8s.KubeConfig()
kc.loadFromDefault()

const coreApi = kc.makeApiClient(k8s.CoreV1Api)

const delete_namespace = ({key, id}) => {
  return coreApi.deleteNamespace(id)
}


;(function get_from_queue(client) {
  client.brpoplpush(process.env.DELETE_QUEUE_NAME, process.env.DELETE_PROCESSING_QUEUE_NAME, 0, (err, data) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }

    const key = data

    data = JSON.parse(data)

    let id = data.metadata.name
    data = data.spec

    delete_namespace({"key": key, "id": id})
      .then(() => console.log(`Setup completed for event: ${id}`))
      .then(_ => client.lremAsync(process.env.DELETE_PROCESSING_QUEUE_NAME, 0, key))
      .catch(err => console.error(err))
      .finally(() => {
        return setImmediate(() => get_from_queue(client))
      })
  })
})(client);

