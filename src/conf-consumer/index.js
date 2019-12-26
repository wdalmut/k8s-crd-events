const k8s = require('@kubernetes/client-node');
const redis = require('redis')
const bluebird = require('bluebird')
bluebird.promisifyAll(redis);

const client = redis.createClient({ host: process.env.REDIS_HOST })

const kc = new k8s.KubeConfig()
kc.loadFromDefault()

const coreApi = kc.makeApiClient(k8s.CoreV1Api)
const appsApi = kc.makeApiClient(k8s.AppsV1Api)
const rbacApi = kc.makeApiClient(k8s.RbacAuthorizationV1Api)
const networkApi = kc.makeApiClient(k8s.NetworkingV1beta1Api)

const create_namespace = ({key, id}) => {
  return coreApi.readNamespace(id)
    .catch(namespace => coreApi.createNamespace({ metadata: { name: id } }))
}

const deploy_payment_gateway = (namespace) => {
  return coreApi.createNamespacedServiceAccount(namespace, {
    apiVersion: "v1",
    kind: "ServiceAccount",
    metadata: {
      name: "payment-gateway-sa",
    }
  })
  .then(() => {
    return rbacApi.createNamespacedRole(namespace, {
      metadata: {
        name: "payment-gateway-role",
      },
      rules: [
        {
          apiGroups: [ "app.corley.it" ],
          resources: [ "orders" ],
          verbs: [ "get" ]
        },
        {
          apiGroups: [ "events.k8s.io" ],
          resources: [ "events" ],
          verbs: [ "create" ]
        }
      ],
    })
  })
  .then(() => {
    return rbacApi.createNamespacedRoleBinding(namespace, {
      metadata: {
        name: "payment-gateway-role-binding"
      },
      roleRef: {
        name: "payment-gateway-role",
        kind: "Role",
        apiGroup: "rbac.authorization.k8s.io",
      },
      subjects: [
        {
          namespace,
          name: "payment-gateway-sa",
          kind: "ServiceAccount",
        },
      ]
    })
  })
  .then(() => {
    return appsApi.createNamespacedDeployment(namespace, {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: {
        namespace,
        name: "payment-gateway"
      },
      spec: {
        minReadySeconds: 10,
        replicas: 2,
        selector: {
          matchLabels: {
            app: "payment-gateway"
          }
        },
        strategy: {
          rollingUpdate: {
            maxSurge: 1,
            maxUnavailable: 1,
          }
        },
        template: {
          metadata: {
            labels: {
              app: "payment-gateway",
            }
          },
          spec: {
            serviceAccountName: "payment-gateway-sa",
            containers: [
              {
                image: "wdalmut/conf-payment-gateway:0.0.7",
                name: "payment-gateway",
                resources: {
                  requests: {
                    memory: "128Mi",
                    cpu: "128m",
                  },
                  limits: {
                    memory: "128Mi",
                    cpu: "128m",
                  }
                }
              }
            ],
          }
        }
      }
    })
  })
  .then(() => {
    return coreApi.createNamespacedService(namespace, {
      metadata: {
        name: "payment-gateway-service"
      },
      spec: {
        type: "ClusterIP",
        ports: [
          {
            protocol: "TCP",
            targetPort: 3000,
            port: 3000,
          }
        ],
        selector: {
          app: "payment-gateway"
        }
      }
    })
  })
  .then(() => {
    return networkApi.createNamespacedIngress(namespace, {
      metadata: {
        name: "payment-gateway-ingress"
      },
      spec: {
        rules: [
          {
            http: {
              paths: [
                {
                  path: `/payment-gateway/${namespace}`,
                  backend: {
                    serviceName: "payment-gateway-service",
                    servicePort: 3000,
                  }
                }
              ]
            }
          }
        ]
      }
    })
  })
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
      .then(() => deploy_payment_gateway(id))
      .then(() => console.log(`Setup completed for event: ${id}`))
      .then(_ => client.lremAsync(process.env.ADD_PROCESSING_QUEUE_NAME, 0, key))
      .catch(err => console.error(err))
      .finally(() => {
        return setImmediate(() => get_from_queue(client))
      })
  })
})(client);

