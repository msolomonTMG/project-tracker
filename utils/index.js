
module.exports = {
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
  formatProjectDialogOptions (optionGroups, project) {
    return new Promise((resolve, reject) => {
      const projectTeamNameLookUp = project.get('Team')
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
