const request = require('request')
const moment = require('moment')
const utils = require('../utils')

const helpers = {
  getStatusOptions () {
    const statuses = ['Green', 'Yellow', 'Red', 'Planning', 'Blocked Internal', 'Blocked External', 'Backlog']
    let statusOptions = []
    for (status of statuses) {
      statusOptions.push({
        label: status,
        value: status
      })
    }
    return statusOptions
  },
  openDialog (dialog, triggerId) {
    console.log('dialog helper')
    return new Promise((resolve, reject) => {
      
      const options = {
        method: 'post',
        body: {
          trigger_id: triggerId,
          dialog: dialog
        },
        json: true,
        url: `https://slack.com/api/dialog.open`,
        headers: {
          'Authorization': `Bearer ${process.env.SLACK_OAUTH_TOKEN}`,
          'Content-type': 'application/json',
          'charset': 'UTF-8'
        }
      }
      
      request(options, (err, response, body) => {
        if (err) { console.error(err); return reject(err); }
        console.log(body)
        return resolve(body)
      })
      
    })
  },
  sendSlackMessage (url, text, attachments) {
    return new Promise((resolve, reject) => {
      
      let postData = {
        text: text,
        attachments: attachments
      }
      
      let options = {
        method: 'post',
        body: postData,
        json: true,
        url: url
      }
      
      request(options, (err, response, body) => {
        if (err) { console.error(err); return reject(err); }
        return resolve(body)
      })
      
    })
  }
}

module.exports = {
  updateMessage (messageOptions) {
    return new Promise((resolve, reject) => {
      let postData = {
        channel: messageOptions.channel,
        text: messageOptions.text,
        ts: messageOptions.timestamp
      }
      
      if (messageOptions.attachments) {
        postData.attachments = messageOptions.attachments
      }
      
      const options = {
        method: 'post',
        body: postData,
        json: true,
        url: `https://slack.com/api/chat.update`,
        headers: {
          'Authorization': `Bearer ${process.env.SLACK_OAUTH_TOKEN}`,
          'Content-type': 'application/json',
          'charset': 'UTF-8'
        }
      }
      
      request(options, (err, response, body) => {
        if (err) { console.error(err); return reject(err); }
        return resolve(body)
      })
    })
  },
  sendPrivateMessage (messageOptions) {
    return new Promise((resolve, reject) => {
      let postData = {
        channel: messageOptions.channel,
        text: messageOptions.text
      }
      
      if (messageOptions.attachments) {
        postData.attachments = messageOptions.attachments
      }
      
      const options = {
        method: 'post',
        body: postData,
        json: true,
        url: `https://slack.com/api/chat.postMessage`,
        headers: {
          'Authorization': `Bearer ${process.env.SLACK_OAUTH_TOKEN}`,
          'Content-type': 'application/json',
          'charset': 'UTF-8'
        }
      }
      
      request(options, (err, response, body) => {
        if (err) { console.error(err); return reject(err); }
        return resolve(body)
      })
    })
  },
  sendEphemeralMessage (messageOptions) {
    return new Promise((resolve, reject) => {
      let postData = {
        channel: messageOptions.channel,
        user: messageOptions.userId,
        text: messageOptions.text
      }
      
      if (messageOptions.attachments) {
        postData.attachments = messageOptions.attachments
      }
      
      const options = {
        method: 'post',
        body: postData,
        json: true,
        url: `https://slack.com/api/chat.postEphemeral`,
        headers: {
          'Authorization': `Bearer ${process.env.SLACK_OAUTH_TOKEN}`,
          'Content-type': 'application/json',
          'charset': 'UTF-8'
        }
      }
      
      request(options, (err, response, body) => {
        if (err) { console.error(err); return reject(err); }
        return resolve(body)
      })
    })
  },
  openStatusForSpecificProjectDialog (triggerId, projectId, projectName, state) {
    console.log(`trigger id is ${triggerId}`)
    return new Promise((resolve, reject) => {
      if (projectName.length > 24) {
        // if name > 24 chars,strip to 21 chars and add three dots
        projectName = projectName.substring(0, 21).concat('...')
      }
      let dialog = {
        callback_id: projectId,
        title: `${projectName}`,
        submit_label: 'Create',
        elements: [
          {
            label: 'Status',
            name: 'status',
            type: 'select',
            options: helpers.getStatusOptions()
          },
          {
            type: 'textarea',
            name: 'description',
            label: 'Description',
            hint: 'What\'s your update?'
          }
        ]
      }
      
      if (state) {
        dialog.state = state
      }
      helpers.openDialog(dialog, triggerId)
    })
  },
  openStatusDialog (triggerId) {
    console.log('opening status dialog')
    return new Promise((resolve, reject) => {
      const dialog = {
        callback_id: 'random_string',
        title: 'Project Status Update',
        submit_label: 'Create',
        elements: [
          {
            label: 'Project',
            name: 'project',
            type: 'select',
            min_query_length: 2,
            data_source: 'external'
          },
          {
            label: 'Status',
            name: 'status',
            type: 'select',
            options: helpers.getStatusOptions()
          },
          {
            type: 'textarea',
            name: 'description',
            label: 'Description',
            hint: 'What\'s your update?'
          }
        ]
      }
      
      helpers.openDialog(dialog, triggerId)
    })
  },
  sendPeopleStatusReport (statusUpdates) {
    return new Promise((resolve, reject) => {
      const statusesView = 'viwRGjGfoLTHUYjBc'
      let text = ':wave: Here is the weekly status report!'
      let attachments = []
      
      statusUpdates.forEach((statusUpdate, index) => {
        console.log(statusUpdate)
        attachments.push({
          color: utils.getStatusColor(statusUpdate.get('Status')),
          title: statusUpdate.get('Project Name') ? statusUpdate.get('Project Name')[0] : '',
          title_link: `https://airtable.com/${process.env.AIRTABLE_BASE_ID}/${statusesView}/${statusUpdate.id}`,
          fields: [
            {
              title: 'Target End Date',
              value: statusUpdate.get('Project Target End') ? statusUpdate.get('Project Target End')[0] : '',
              short: true
            },
            {
              title: 'Progress',
              value: statusUpdate.get('Project Progress') ? `${Math.round(statusUpdate.get('Project Progress')[0])}%` : '',
              short: true
            },
            {
              title: 'Owner',
              value: statusUpdate.get('Project Owner Name') ? statusUpdate.get('Project Owner Name')[0] : '',
              short: true
            },
            {
              title: 'Status',
              value: statusUpdate.get('Status'),
              short: true
            },
            {
              title: 'Description',
              value: statusUpdate.get('Description'),
              short: false
            }
          ],
          footer: 'Last Updated',
          ts: moment(statusUpdate.get('Created')).unix()
        })
        
        if (index + 1 == statusUpdates.length) {
          helpers.sendSlackMessage(process.env.PEOPLE_STATUS_UPDATES_SLACK_CHANNEL, text, attachments)
        }
      })
      
    })
  }
}
