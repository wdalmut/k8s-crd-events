const k8s = require('@kubernetes/client-node');
const redis = require('redis')

const client = redis.createClient({ host: process.env.REDIS_HOST })

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CustomObjectsApi);

const informer = k8s.makeInformer(kc, '/apis/app.corley.it/v1/orders', () => {
  return k8sApi.listClusterCustomObject('app.corley.it', 'v1', 'orders')
})

informer.on('add', obj => client.lpush(process.env.ADD_QUEUE_NAME, JSON.stringify(obj), redis.print))
informer.on('update', obj => client.lpush(process.env.UPDATE_QUEUE_NAME, JSON.stringify(obj), redis.print))
informer.on('delete', obj => client.lpush(process.env.DELETE_QUEUE_NAME, JSON.stringify(obj), redis.print))

informer.start()
