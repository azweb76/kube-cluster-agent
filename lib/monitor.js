'use strict'

const k8s = require('k8s-client');
const async = require('async');
const utils = require('./utils');

class Monitor{
  constructor(agent){
    this.agent = agent;
    this.k8s = agent.k8s;
    this.allk8s = agent.allk8s;
    this.options = agent.options;
    this.checks = require('./checks').get(agent.options);
    this.alerts = {};
  }
  invokeCheck(check, cb){
    check.check(this, (err, result) => {
      if(err) return cb(err);
      cb(null, {name: check.name, result: result});
    });
  }
  getMaxPods(cb){
    if(this.options.max_pods != null){
      cb(null, this.options.max_pods)
    } else {
      this.allk8s.nodes.get((err, results) => {
        if (err) return cb(err);
        const failedNodes = [];
        const nodes = results[0].items;
        var maxPods = 0;
        for (var node of nodes) {
          var ready = false;
          for (var condition of node.status.conditions){
            if (condition.type == 'Ready'){
              if (condition.status == 'True'){
                ready = true;
              }
            }
          }
          if (ready) {
            maxPods += parseInt(node.status.capacity.pods);
          }
        }
        cb(null, maxPods);
      });
    }
  }
  poller() {
    async.map(this.checks, this.invokeCheck.bind(this), (err, checkResults) => {
      if (err) return;
      async.each(checkResults, (checkResult, cb) => {
        const result = checkResult.result;
        if (result.success){
          if (checkResult.name in this.alerts){
            this.agent.notify({
              title: `check ${checkResult.name} restored`,
              message: result.message,
              color: 'good',
              items: result.items
            }, err => {
              delete this.alerts[checkResult.name]
              return cb(null);
            });
          } else {
            return cb(null);
          }
        }
        else {
          if (!(checkResult.name in this.alerts)){
            this.agent.notify({
              title: `failed check ${checkResult.name}`,
              message: result.message,
              color: 'danger',
              items: result.items
            }, err => {
              this.alerts[checkResult.name] = result;
              return cb(null);
            });
          } else {
            return cb(null);
          }
        }
      }, err => {
        setTimeout(this.poller.bind(this), this.options.monitor_interval);
      });
    });
  }
  start(){
    this.poller();
  }
}

module.exports = exports = Monitor;
