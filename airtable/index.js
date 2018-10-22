const Airtable = require('airtable')
const base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base(process.env.AIRTABLE_BASE_ID)

module.exports = {
  getRecordsFromView (tableName, viewName, sortOptions, maxRecords) {
    return new Promise((resolve, reject) => {
      
      let recordsToReturn = []
      
      let retrievalOptions = {
        view: viewName
      }
      
      if (sortOptions) {
        retrievalOptions.sort = sortOptions
      }
      
      if (maxRecords) {
        retrievalOptions.maxRecords = maxRecords
      }
      console.log(tableName)
      console.log(viewName)
      console.log(sortOptions)
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
  }
}
