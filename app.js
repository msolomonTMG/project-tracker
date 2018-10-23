const
  express = require('express'),
  bodyParser = require('body-parser'),
  airtable = require('./airtable'),
  utils = require('./utils'),
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
  const payload = JSON.parse(req.body.payload)
  switch(payload.type) {
    case 'dialog_submission':
      // we currently only have project status dialogs
      // but in the future we may want to check what to do here
      const newStatus = await airtable.createStatusUpdateFromDialog(payload.submission)
      console.log(newStatus)
      slack.sendEphemeralMessage({
        channel: payload.channel.id,
        userId: payload.user.id,
        text: ':white_check_mark: Status created successfully!',
        attachments: [
          {
            title: newStatus.get('Project Name')[0],
            fields: [
              {
                title: 'Status',
                value: newStatus.get('Status'),
                short: true
              },
              {
                title: 'Description',
                value: newStatus.get('Description'),
                short: false
              }
            ]
          }
        ]
      })
      break;
  }
  
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
      let projects = await airtable.getRecordsFromView('Projects', {
        view: 'All Projects',
        sortOptions: [{field: "Name", direction: "asc"}],
        maxRecords: 100
      })
      let optionGroups = []
      for (const project of projects) {
        optionGroups = await utils.formatProjectDialogOptions(optionGroups, project)
      }

      res.status(200).send({
        option_groups: optionGroups
      })
      break;
  }
})

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
})

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'
module.exports = app
