const k8s = require('@kubernetes/client-node');
const redis = require('redis')

const client = redis.createClient({ host: process.env.REDIS_HOST })

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CustomObjectsApi);

const informer = k8s.makeInformer(kc, '/apis/app.corley.it/v1/conferences', () => {
  return k8sApi.listClusterCustomObject('app.corley.it', 'v1', 'conferences')
})

informer.on('add', obj => console.log(`Added conference ${obj.metadata.name}`))
informer.on('add', obj => client.lpush('add-conf', JSON.stringify(obj), redis.print))

informer.on('update', obj => console.log(`Added conference ${obj.metadata.name}`))
informer.on('update', obj => client.lpush('update-conf', JSON.stringify(obj), redis.print))

informer.on('delete', obj => console.log(`Added conference ${obj.metadata.name}`))
informer.on('delete', obj => client.lpush('delete-conf', JSON.stringify(obj), redis.print))

informer.start()
