const
  express = require('express'),
  bodyParser = require('body-parser'),
  slack = require('./slack');

let app = express()
app.set('port', process.env.PORT || 3000)
app.use(bodyParser.urlencoded({
  extended: true
}))
app.use(bodyParser.json())

// used for slack slash command execution
app.post('/project-status', async function(req, res) {
  console.log(req.body)
  if (req.body.challenge) {
    return res.send(req.body.challenge)
  }
  
  slack.openStatusDialog(req.body.trigger_id)
  // slack will post OK in the channel if you just return 200
  res.setHeader('Content-Type', 'application/json');
  res.status(200).send()
})

// used for dialog submission callback
app.post('/interactivity', async function(req, res) {
  console.log('INTERACTIVITY')
  console.log(req.body)
  
  // do something here before returning empty body
  res.setHeader('Content-Type', 'application/json')
  //stupid slack needs an empty body
  res.status(200).send({})
})

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
})

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'
module.exports = app
