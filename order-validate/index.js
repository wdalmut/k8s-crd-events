const fs = require('fs')
const express = require('express')
const bodyParser = require('body-parser')
const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CustomObjectsApi);

var https = require('https');

var privateKey  = fs.readFileSync('orders-validate-service.kconference.svc.key', 'utf8');
var certificate = fs.readFileSync('orders-validate-service.kconference.svc.crt', 'utf8');

var credentials = {key: privateKey, cert: certificate};

const app = express()

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.post('/', (req, res) => {
  let request = req.body.request
  let object = req.body.request.object

  let uid = request.uid
  let planRef = object.spec.planRef
  let couponRef = object.spec.couponRef

  k8sApi.getNamespacedCustomObject(request.kind.group, 'v1', object.metadata.namespace, 'plans', planRef)
    .then(plan => {
      if (couponRef) {
        return k8sApi.getNamespacedCustomObject(request.kind.group, 'v1', object.metadata.namespace, 'coupons', couponRef)
          .then(coupon => {
            let final_price = plan.body.spec.price - coupon.body.spec.price
            if (object.spec.price == final_price) {
              return plan
            }

            return Promise.reject({ body: { message: `Your price is not well suited with the plan and coupon! It should be: ${final_price}` } })
          })
      }

      return Promise.resolve(plan)
    })
    .then(_ => {
      if (object.spec.price < 0) {
        return Promise.reject({ body: { message: "Order price can not be negative..." } })
      }

      return Promise.resolve(_)
    })
    .then(_ => {
      console.log(`Allow create ${request.name}`)

      return res.json({
        "apiVersion": "admission.k8s.io/v1",
        "kind": "AdmissionReview",
        "response": {
          "uid": uid,
          "allowed": true,
        }
      })
    })
    .catch(err => {
      console.log(`Deny create ${request.name}`)

      return res.json({
        "apiVersion": "admission.k8s.io/v1",
        "kind": "AdmissionReview",
        "response": {
          "uid": uid,
          "allowed": false,
          "status": {
            "code": 400,
            "message": `Your order is not valid: ${err.body.message}`
          }
        }
      })
    })

})

const httpsServer = https.createServer(credentials, app);
httpsServer.listen(443);

