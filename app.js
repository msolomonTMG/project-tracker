const
  express = require('express'),
  bodyParser = require('body-parser'),
  airtable = require('./airtable'),
  slack = require('./slack');

let app = express()
app.set('port', process.env.PORT || 3000)
app.use(bodyParser.urlencoded({
  extended: true
}))
app.use(bodyParser.json())

// used for slack slash command execution
app.post('/project-status', async function(req, res) {
  console.log('/PROJECT-STATUS')
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
  console.log('/INTERACTIVITY')
  console.log(req.body)
  
  // do something here before returning empty body
  res.setHeader('Content-Type', 'application/json')
  //stupid slack needs an empty body
  res.status(200).send({})
})

//used to get dialog select options
app.post('/dialog-options-load', async function(req, res) {
  console.log('/dialog-options-load')
  console.log(req.body)
  const payload = JSON.parse(req.body.payload)
  
  // we may want to do different things for different dialog fields
  // we can tell what dialog field we're populating by the name
  switch(payload.name) {
    case 'project':
      console.log('finding projects')
      let projects = await airtable.getRecordsFromView('Projects', 'All Projects',[{field: "Name", direction: "asc"}], 100)
      let options = []
      for (project of projects) {
        let projectName = project.get('Name')
        if (projectName.length > 24) {
          // if name > 24 chars,strip to 21 chars and add three dots
          projectName = projectName.substring(0, 21).concat('...')
        }
        
        options.push({
          label: `${projectName}`,
          value: `${project.id}`
        })
      }
      console.log('OPTIONS')
      console.log(options)
      res.status(200).send({
        options: options
      })
      break;
  }
})

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
})

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'
module.exports = app
