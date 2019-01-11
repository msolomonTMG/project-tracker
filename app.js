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
        const projectName = payload.actions[0].name
        const state = {original_message_ts: payload.original_message.ts}
        slack.openStatusForSpecificProjectDialog(payload.trigger_id, payload.callback_id, projectName, state)
        // slack will post OK in the channel if you just return 200
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send()
      } else if (payload.actions[0].name == 'update_project_statuses') {
        // get all non-backlogged, not-done projects where this person is the owner
        const projectsOwnedByPerson = await airtable.getRecordsFromView('Projects', {
          view: 'All Projects',
          sort: [{field: 'Latest Status', direction: 'desc'}],
          filterByFormula: `IF({Owner}="${payload.callback_id}", IF({Is Active}=1, TRUE(), FALSE()), FALSE())`
        })
        // for each project, send a private message where the user can change the status
        for (const project of projectsOwnedByPerson) {
          const attachments = [{
            callback_id: `${project.id}`,
            attachment_type: 'default',
            title: `${project.get('Name')}`,
            color: utils.getStatusColor(`${project.get('Latest Status')}`),
            fields: [
              {
                title: 'Latest Status',
                value: project.get('Latest Status') ? project.get('Latest Status')[0] : '',
                short: true
              },
              {
                title: 'Last Updated',
                value: project.get('Last Updated'),
                short: true
              },
              {
                title: 'Latest Update',
                value: project.get('Latest Update') ? project.get('Latest Update')[0] : '',
                short: false
              }
            ],
            callback_id: `${project.id}`,
            actions: [
              {
                name: `${project.get('Name')}`,
                text: 'Create Status Update',
                type: 'button',
                value: 'create_status'
              }
            ]
          }]
          slack.sendPrivateMessage({
            channel: payload.actions[0].value,
            text: '',
            attachments: attachments
          })
        }
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
              },
              {
                name: 'move_task_to_next_week',
                text: 'Move to Next Week',
                type: 'button',
                value: `${task.id}`
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
      } else if (payload.actions[0].name == 'move_task_to_next_week') {
        // get the record for the next week
        const nextWeekRecords = await airtable.getRecordsFromView('Weeks', {
          view: 'All Weeks',
          filterByFormula: 'IF({Is Next Week}, TRUE(), FALSE())',
          maxRecords: 1
        })
        // update the task to be part of the next week
        const updatedRecord = await airtable.updateRecord('Tasks', payload.actions[0].value, {
          'Week': [nextWeekRecords[0].id]
        })
        // copy the actions of the original message
        let updatedMessageAttachments = payload.original_message.attachments
        // get the index of the Move to Next Week button
        const buttonIndex = updatedMessageAttachments[0].actions.findIndex((action => action.name === 'move_task_to_next_week'))
        // update the button to become a Move Back to This Week button
        updatedMessageAttachments[0].actions[buttonIndex].name = 'move_task_to_this_week'
        updatedMessageAttachments[0].actions[buttonIndex].text = 'Move Back to This Week'
        slack.updateMessage({
          channel: payload.channel.id,
          text: payload.original_message.text,
          attachments: updatedMessageAttachments,
          timestamp: payload.original_message.ts
        })
        // slack will post OK in the channel if you just return 200
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send()
      } else if (payload.actions[0].name == 'move_task_to_this_week') {
        // get the record for the this week
        const thisWeekRecords = await airtable.getRecordsFromView('Weeks', {
          view: 'All Weeks',
          filterByFormula: 'IF({Is This Week}, TRUE(), FALSE())',
          maxRecords: 1
        })
        // update the task to be part of the this week
        const updatedRecord = await airtable.updateRecord('Tasks', payload.actions[0].value, {
          'Week': [thisWeekRecords[0].id]
        })
        // copy the actions of the original message
        let updatedMessageAttachments = payload.original_message.attachments
        // get the index of the Move to This Week button
        const buttonIndex = updatedMessageAttachments[0].actions.findIndex((action => action.name === 'move_task_to_this_week'))
        // update the button to become a Move Back to This Week button
        updatedMessageAttachments[0].actions[buttonIndex].name = 'move_task_to_next_week'
        updatedMessageAttachments[0].actions[buttonIndex].text = 'Move to Next Week'
        slack.updateMessage({
          channel: payload.channel.id,
          text: payload.original_message.text,
          attachments: updatedMessageAttachments,
          timestamp: payload.original_message.ts
        })
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
        //TODO: use await here for consistency
        const updatedRecord = await airtable.updateRecord('Tasks', taskId, {
          'Status': newStatus
        })
        // create a new message by copying the original message
        let updatedMessageAttachments = payload.original_message.attachments
        // find the index of the Status field in the new message
        const statusIndex = updatedMessageAttachments[0].fields.findIndex((field => field.title === 'Status'))
        // update the value of the Status field to match the new status
        // but if the new status is blank, send To Do
        if (!newStatus) {
          newStatus = 'To Do'
        }
        updatedMessageAttachments[0].fields[statusIndex].value = newStatus
        // set new color of the attachment based on new status
        updatedMessageAttachments[0].color = utils.getStatusColor(newStatus)
        slack.updateMessage({
          channel: payload.channel.id,
          text: payload.original_message.text,
          attachments: updatedMessageAttachments,
          timestamp: payload.original_message.ts
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
      const attachments = [
        {
          title: newStatus.get('Project Name')[0],
          color: utils.getStatusColor(newStatus.get('Status')),
          fields: [
            {
              title: 'Latest Status',
              value: newStatus.get('Status'),
              short: true
            },
            {
              title: 'Last Updated',
              value: newStatus.get('Name'),
              short: true
            },
            {
              title: 'Latest Update',
              value: newStatus.get('Description'),
              short: false
            }
          ]
        }
      ]
      if (payload.state) {
        const state = JSON.parse(payload.state)
        slack.updateMessage({
          channel: payload.channel.id,
          text: ':white_check_mark: Status created successfully!',
          attachments: attachments,
          timestamp: state.original_message_ts
        })
      } else {
        slack.sendEphemeralMessage({
          channel: payload.channel.id,
          userId: payload.user.id,
          text: ':white_check_mark: Status created successfully!',
          attachments: attachments
        })
      }
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
