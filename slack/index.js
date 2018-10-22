const request = require('request')
const moment = require('moment')

const helpers = {
  getStatusColor (status) {
    switch(status) {
      case 'Planning':
        return '#1DD9D2'
        break;
      case 'Green':
        return '#21C932'
        break;
      case 'Yellow':
        return '#FCB400'
        break;
      case 'Red':
        return '#F82C60'
        break;
      case 'Blocked Internal':
        return '#2C7FF9'
        break;
      case 'Blocked External':
        return '#8B46FF'
        break;
      default:
        return '#D5D5D5'
        break;
    }
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
  sendPeopleStatusReport (statusUpdates) {
    return new Promise((resolve, reject) => {
      const statusesView = 'viwRGjGfoLTHUYjBc'
      let text = ':wave: Here is the weekly status report!'
      let attachments = []
      
      statusUpdates.forEach((statusUpdate, index) => {
        console.log(statusUpdate)
        attachments.push({
          color: helpers.getStatusColor(statusUpdate.get('Status')),
          title: statusUpdate.get('Project Name')[0],
          title_link: `https://airtable.com/${process.env.AIRTABLE_BASE_ID}/${statusesView}/${statusUpdate.id}`,
          fields: [
            {
              title: 'Target End Date',
              value: statusUpdate.get('Project Target End') ? statusUpdate.get('Project Target End')[0] : '',
              short: true
            },
            {
              title: 'Progress',
              value: `${Math.round(statusUpdate.get('Project Progress')[0])}%`,
              short: true
            },
            {
              title: 'Owner',
              value: statusUpdate.get('Project Owner Name')[0],
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
