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
      } else if (payload.actions[0].name == 'manage_tasks') {
        // get tasks assigned to this person and planned for this week
        const tasksAssignedToPerson = await airtable.getRecordsFromView('Tasks', {
          view: 'All Tasks',
          filterByFormula: `IF(Assignee='${payload.callback_id}', IF({Is Planned For This Week}=1, TRUE(), FALSE()), FALSE())`,
          sort: [{field: 'Status', direction: 'asc'}]
        })
        
        for (const task of tasksAssignedToPerson) {
          const attachments = [{
            callback_id: `${task.id}`,
            attachment_type: 'default',
            title: `${task.get('Name')}`,
            color: utils.getStatusColor(`${task.get('Status')}`),
            fields: [
              {
                title: 'Project',
                value: `${task.get('Project Name Rollup')}`,
                short: true
              },
              {
                title: 'Status',
                value: task.get('Status') ? task.get('Status') : 'To Do'
              }
            ],
            actions: [
              {
                name: 'task_status_selector',
                text: 'Update status to...',
                type: 'select',
                options: [
                  {
                    text: 'To Do',
                    value: 'To Do'
                  },
                  {
                    text: 'In Progress',
                    value: 'In Progress'
                  },
                  {
                    text: 'Blocked',
                    value: 'Blocked'
                  },
                  {
                    text: 'Done',
                    value: 'Done'
                  }
                ]
              }
            ]
          }]
          slack.sendPrivateMessage({
            channel: payload.actions[0].value,
            text: '',
            attachments: attachments
          })
        }
        // slack will post OK in the channel if you just return 200
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send()
      } else if (payload.actions[0].name == 'task_status_selector') {
        let newStatus = payload.actions[0].selected_options[0].value
        // slack doesnt allow for null values so we use To Do as a placeholder
        // and then we set the newStatus to be blank here
        if (newStatus == 'To Do') {
          newStatus = null
        }
        const taskId = payload.callback_id
        airtable.updateRecord('Tasks', taskId, {
          'Status': newStatus
        })
        
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
      let projectRetrievalOptions = {
        view: 'All Projects',
        sort: [{field: "Name", direction: "asc"}],
        maxRecords: 100
      }
      if (payload.value) {
        projectRetrievalOptions.filterByFormula = `FIND(LOWER("${payload.value}"), LOWER(Name), 0)`
      }
      let projects = await airtable.getRecordsFromView('Projects', projectRetrievalOptions)
      
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
