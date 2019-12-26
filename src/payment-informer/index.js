const k8s = require('@kubernetes/client-node');
const redis = require('redis')

const client = redis.createClient({ host: process.env.REDIS_HOST })

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.EventsV1beta1Api);

const informer = k8s.makeInformer(kc, '/apis/events.k8s.io/v1beta1/events', () => {
  return k8sApi.listEventForAllNamespaces(undefined, undefined, undefined, "payment-gateway.app.corley.it=PAYPAL")
})

informer.on('add', obj => (obj.reason === 'PaymentConfirmed') ? client.lpush(process.env.ADD_QUEUE_NAME, JSON.stringify(obj), redis.print) : Promise.resolve())

informer.start()
