'use strict'

const k8s = require('k8s-client');
const async = require('async');
const utils = require('./utils');

class Retention{
  constructor(options){
    this.agent = options.agent;
    this.k8s = options.k8s;
    this.options = options;
    this.agentOptions = options.agent.options;
  }
  getReplicationControllers(cb){
    this.k8s.replicationControllers.get((err, rcs) => {
      if (err) return cb(err);
      const nowDt = Date.now();
      const expired = [];
      for (var rc of rcs[0].items) {
        if(rc.metadata.annotations && rc.metadata.annotations.pinned_dt){
          const pinDt = Date.parse(rc.metadata.annotations.pinned_dt);
          if (pinDt < nowDt) {
            expired.push(rc.metadata);
          }
        }
      }
      cb(null, expired);
    })
  }
  deleteService(rc, cb){
    console.log(`deleting service ${rc.name}...`);
    this.k8s.services.delete(rc.name, (err, svc) => {
      if (err){
        if (!err.statusCode || err.statusCode != 404){
          return cb(err);
        }
      }
      return cb(null, svc);
    });
  }
  deleteReplicationController(rc, cb){
    console.log(`deleting rc ${rc.name}...`);
    this.k8s.replicationControllers.delete(rc.name, (err, rc) => {
      if (err){
        if (!err.statusCode || err.statusCode != 404){
          return cb(err);
        }
      }
      return cb(null, rc);
    });
  }
  deleteServices(expired, cb){
    async.eachLimit(expired, this.agentOptions.parallelism,
      this.deleteService.bind(this), err => {
      cb(err, expired);
    });
  }
  deleteReplicationControllers(expired, cb){
    async.eachLimit(expired, this.agentOptions.parallelism,
      this.deleteReplicationController.bind(this), err => {
        cb(err, expired);
      })
  }
  poller() {
    async.autoInject({
      getReplicationControllers: this.getReplicationControllers.bind(this),
      deleteServices: ['getReplicationControllers', this.deleteServices.bind(this) ],
      deleteReplicationControllers: ['deleteServices', this.deleteReplicationControllers.bind(this) ]
    }, (err, results) => {
      console.log(`deleted ${results.getReplicationControllers.length} builds from ${this.options.namespace} namespace`);
      setTimeout(this.poller.bind(this), this.agentOptions.retention_interval)
    });
  }
  start(){
    this.poller();
  }

  static createFromNamespaces(agent){
    const retention = [];
    for(var ns of agent.options.namespace){
      const ret = new Retention({
        k8s: agent.k8s[ns],
        namespace: ns,
        agent: agent
      });
      retention.push(ret);
    }
    return retention;
  }
}

module.exports = exports = Retention;
