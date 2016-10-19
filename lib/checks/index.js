'use strict'

const checkProviders = [
  require('./nodes'),
  require('./capacity'),
  require('./pods')
];

module.exports = exports = {
  get: function(options){
    const checks = [];
    for(var check of checkProviders){
      if (check.isEnabled){
        if (!check.isEnabled(options)){
          continue
        }
      }
      if (options.monitor && options.monitor.length > 0 && options.monitor.indexOf(check.name) == -1){
        continue
      }
      if(check.namespace){
        for(var ns of options.namespace){
          checks.push({name:`${check.name}-${ns}`, check: check.check, namespace: ns});
        }
      } else {
        checks.push({name:`${check.name}`, check: check.check, namespace: 'default'});
      }
    }
    return checks;
  }
}
