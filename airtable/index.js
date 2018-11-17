const Airtable = require('airtable')
const base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base(process.env.AIRTABLE_BASE_ID)

module.exports = {
  getRecordsFromView (tableName, retrievalOptions) {
    console.log('getting airtable records')
    return new Promise((resolve, reject) => {
      
      let recordsToReturn = []

      base(tableName).select(retrievalOptions).eachPage(function page(records, fetchNextPage) {
        records.forEach(record => {
          recordsToReturn.push(record)
        })
        fetchNextPage()
      }, function done(err) {
        if (err) { console.error(err); return reject(err); }
        return resolve(recordsToReturn)
      })
      
    })
  },
  updateRecord (tableName, recordId, updateOptions) {
    return new Promise((resolve, reject) => {
      base(tableName).update(recordId, updateOptions, (err, record) => {
        if (err) { console.error(err); return reject(err); }
        return resolve(record)
      })
    })
  },
  createStatusUpdateFromDialog (dialogSubmission) {
    return new Promise((resolve, reject) => {
      base('Status Updates').create({
        'Project': [ dialogSubmission.project ],
        'Description': dialogSubmission.description,
        'Status': dialogSubmission.status
      }, (err, record) => {
        if (err) { console.error(err); return reject(err); }
        return resolve(record)
      })
    })
  }
}
