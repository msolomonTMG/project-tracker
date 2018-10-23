
module.exports = {
  formatProjectDialogOptions (optionGroups, project) {
    return new Promise((resolve, reject) => {
      const projectTeamNameLookUp = project.get('Team Name Lookup')
      let projectTeamName = 'No Team Defined'
      if (projectTeamNameLookUp) {
        projectTeamName = projectTeamNameLookUp[0]
      }
      let projectName = project.get('Name')
      if (projectName.length > 24) {
        // if name > 24 chars,strip to 21 chars and add three dots
        projectName = projectName.substring(0, 21).concat('...')
      }
      const groupIndex = optionGroups.findIndex(group => {
        return group.label === projectTeamName
      })

      if (groupIndex < 0) {
        optionGroups.push({
          label: projectTeamName,
          options: [
            {
              label: `${projectName}`,
              value: `${project.id}`
            }
          ]
        })
      } else {
        optionGroups[groupIndex].options.push({
          label: `${projectName}`,
          value: `${project.id}`
        })
      }
      
      return resolve(optionGroups)
    })
  }
}
