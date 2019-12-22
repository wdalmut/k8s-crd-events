const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

k8sApi.listConfigMapForAllNamespaces().then((a) => console.log(a.body))

const informer = k8s.makeInformer(kc, "/api/v1/configmaps", () => {
  console.log("list")
  return k8sApi.listConfigMapForAllNamespaces()
});

informer.on("add", (obj) => {
  console.log(`Added: ${obj.metadata.name}`);
});
informer.on("update", (obj) => {
  console.log(`Updated: ${obj.metadata.name}`);
});
informer.on("delete", (obj) => {
  console.log(`Deleted: ${obj.metadata.name}`);
});

informer.start();
