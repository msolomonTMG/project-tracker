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
  const payload = req.body
  // make sure that whatever user triggered this slash command
  // is a user that we recognize from airtable
  const airtableUser = await airtable.getRecordsFromView('People', {
    view: 'All People',
    filterByFormula: `FIND(UPPER("${payload.user_id}"), UPPER({Slack User ID}), 0)`,
    maxRecords: 1
  })
  if (!airtableUser.length) {
    // we didn't find the slack user id in airtable so send error message
    slack.sendEphemeralMessage({
      userId: payload.user_id,
      channel: payload.channel_id,
      text: ':hand: hold up a sec. your Slack User ID can’t be found in this Airtable. Reach out to People Operations if you require assistance.'
    })
  } else {
    // we found the slack user id in airtable so pop the dialog 
    slack.openStatusDialog(payload.trigger_id)
  }
  
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
    case 'interactive_message':
      if (payload.actions[0].value == 'create_status') {
        let projectName = payload.actions[0].name
        slack.openStatusForSpecificProjectDialog(payload.trigger_id, payload.callback_id, projectName)
        // slack will post OK in the channel if you just return 200
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send()
      }
      break;
    case 'dialog_submission':
      // we currently only have project status dialogs
      // but in the future we may want to check what to do here
      console.log('DIALOG SUB')
      console.log(payload)
      if (!payload.submission.project) {
        // there is a type of dialog that does not require the user to enter
        // the project so we do it for them in the callback_id field
        payload.submission.project = payload.callback_id
      }
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
      res.setHeader('Content-Type', 'application/json')
      //stupid slack needs an empty body
      res.status(200).send({})
      break;
    default:
      res.setHeader('Content-Type', 'application/json')
      //stupid slack needs an empty body
      res.status(200).send({})
  }
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
        sort: [{field: "Name", direction: "asc"}],
        filterByFormula: `FIND(LOWER("${payload.value}"), LOWER(Name), 0)`,
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
