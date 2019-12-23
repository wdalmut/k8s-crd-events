const k8s = require('@kubernetes/client-node');
const redis = require('redis')
const bluebird = require('bluebird')
bluebird.promisifyAll(redis);

const client = redis.createClient({ host: process.env.REDIS_HOST })

const kc = new k8s.KubeConfig()
kc.loadFromDefault()

const k8sApi = kc.makeApiClient(k8s.CoreV1Api)

const create_namespace = ({key, id}) => {
  return k8sApi.readNamespace(id)
    .catch(namespace => k8sApi.createNamespace({ metadata: { name: id } }))
    .then(_ => client.lremAsync(process.env.ADD_PROCESSING_QUEUE_NAME, 0, key))
}

;(function get_from_queue(client) {
  client.brpoplpush(process.env.ADD_QUEUE_NAME, process.env.ADD_PROCESSING_QUEUE_NAME, 0, (err, data) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }

    const key = data

    data = JSON.parse(data)

    let id = data.metadata.name
    data = data.spec

    create_namespace({"key": key, "id": id})
      .then(() => console.log(`Setup completed for event: ${id}`))
      .catch(err => console.error(err))
      .finally(() => {
        return setImmediate(() => get_from_queue(client))
      })
  })
})(client);

