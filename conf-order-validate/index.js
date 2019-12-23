const fs = require('fs')
const express = require('express')
const bodyParser = require('body-parser')

var https = require('https');

var privateKey  = fs.readFileSync('orders-validate-service.kconference.svc.key', 'utf8');
var certificate = fs.readFileSync('orders-validate-service.kconference.svc.crt', 'utf8');

var credentials = {key: privateKey, cert: certificate};

const app = express()

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

const port = process.env.NODE_PORT || 3000

app.post('/', (req, res) => {
  console.log(JSON.stringify(req.body))

  let uid = req.body.request.uid

  return res.json({
    "apiVersion": "admission.k8s.io/v1",
    "kind": "AdmissionReview",
    "response": {
      "uid": uid,
      "allowed": false,
      "status": {
        "code": 400,
        "message": "We are not ready to accept those orders!"
      }
    }
  })
})

const httpsServer = https.createServer(credentials, app);
httpsServer.listen(443);

