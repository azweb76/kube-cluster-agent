'use strict'

const util = require('util');

module.exports = exports = {
  extend: function(def, obj){
    return util._extend(def, obj);
  },
  tdelta: function tdelta(str){
    const keys = ["days", "hours", "minutes", "seconds"];
    const multipliers = {d: 24*60*60*1000, h: 60*60*1000, m:60*1000, s:1000};
    const items = [];
    for(let item of keys){
      items.push(`((\\d+)(${item[0]}))?`)
    }
    const re = new RegExp(items.join(''));
    const matches = re.exec(str);

    var timespan = 0;
    for(var i = 1; i < matches.length; i+=3){
      if(matches[i]){
        timespan += multipliers[matches[i+2]] * parseInt(matches[i+1]);
      }
    }

    return timespan;
  },
  toSelector: function toSelector(args){
    const labels = {};
    const labelExprs = args.split(',');
    for(var labelExpr of labelExprs){
      const labelMatch = labelExpr.match(/([a-zA-Z0-9_-]+)=(.*)/);
      if(labelMatch){
        labels[labelMatch[1]] = labelMatch[2];
      }
    }
    return labels;
  },
  selectorsMatch(labels, selector){
    if(selector === null){
      return true;
    }
    if(labels === null){
      return false;
    }
    for(var label in selector){
      if(typeof labels[label] === 'undefined'){
        return false;
      }
      else if(labels[label] !== selector[label]){
        return false;
      }
    }
    return true;
  }
}