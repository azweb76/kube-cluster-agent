'use strict'

const k8s = require('k8s-client');
const async = require('async');
const utils = require('./utils');
const moment = require('moment');

class Retention{
  constructor(options){
    this.agent = options.agent;
    this.k8s = options.k8s;
    this.options = options;
    this.agentOptions = options.agent.options;
  }
  getDuration(str) {
    let days = str.match(/(\d+)\s*d/);
    let hours = str.match(/(\d+)\s*h/);
    let minutes = str.match(/(\d+)\s*m/);
    let seconds = str.match(/(\d+)\s*s/);
    if (days) { return [days[1], 'd'] }
    if (hours) { return [hours[1], 'h'] }
    if (minutes) { return [minutes[1], 'm'] }
    if (seconds) { return [seconds[1], 's'] }
    if (!isNaN(str)) { return [parseInt(str), 's'] }
    return null;
  }
  getReplicationControllers(cb){
    return new Promise((resolve, reject) => {
      this.k8s.replicationControllers.get((err, rcs) => {
        if (err) return reject(err);
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
        return resolve(expired);
      });
    });
  }
  getAllReplicationControllers(cb){
    return new Promise((resolve, reject) => {
      this.k8s.replicationControllers.get((err, rcs) => {
        if (err) return reject(err);
        const rcs_by_name = {};
        for (var rc of rcs[0].items){
          rcs_by_name[rc.metadata.name] = rc;
        }
        return resolve(rcs_by_name);
      });
    });
  }
  getDeployments(cb) {
    return new Promise((resolve, reject) => {
      this.k8s.deployments.get((err, ds) => {
        if (err) return reject(err);
        const nowDt = Date.now();
        const expired = [];
        for (var d of ds[0].items) {
          if (d.metadata.annotations) {
            if (d.metadata.annotations.pinned_dt) {
              const pinDt = Date.parse(d.metadata.annotations.pinned_dt);
              if (pinDt < nowDt) {
                expired.push(d.metadata);
              }
            } else if (d.metadata.annotations.retention) {
              const retStr = this.getDuration(d.metadata.annotations.retention)
              if (retStr != null) {
                const retDt = moment(d.metadata.creationTimestamp).add(retStr[0], retStr[1]).toDate();
                if (retDt < nowDt) {
                  expired.push(d.metadata);
                }
              }
            }
          }
        }
        return resolve(expired);
      });
    });
  }
  getAllServices(cb){
    return new Promise((resolve, reject) => {
      this.k8s.services.get((err, svcs) => {
        if (err) return reject(err);
        const by_name = {};
        for (var svc of svcs[0].items){
          by_name[svc.metadata.name] = svc;
        }
        return resolve(by_name);
      });
    });
  }
  cleanupOrphanedObjects(typeName, age, parents){
    return new Promise((resolve, reject) => {
      const startDt = Date.now() - age;
      this.k8s[typeName].getBySelector({cicd: 'pnc'}, (err, objects) => {
        if (err){
          // ingress is not supported
          if (err.statusCode && err.statusCode === 404){
            return resolve(parents);
          }
          console.log(err);
          return reject(err);
        }
        async.eachLimit(objects.items, this.agentOptions.parallelism, (o, cb) => {
          const dt = Date.parse(o.metadata.creationTimestamp);
          if (dt < startDt && !parents[o.metadata.name]){
            console.log(`deleting orphaned ${typeName} "${o.metadata.name}"...`)
            this.k8s[typeName].delete(o.metadata.name, err => {
              return cb(err, null);
            });
          }
          else {
            cb(null);
          }
        }, err => {
          resolve(parents);
        });
      });
    });
  }
  deleteService(rc, cb){
    return new Promise((resolve, reject) => {
      console.log(`deleting service ${rc.name}...`);
      this.k8s.services.delete(rc.name, (err, svc) => {
        if (err){
          if (!err.statusCode || err.statusCode != 404){
            return reject(err);
          }
        }
        return resolve(rc);
      });
    });
  }
  deleteIngress(rc){
    return new Promise((resolve, reject) => {
      console.log(`deleting ingress ${rc.name}...`);
      this.k8s.ingresses.delete(rc.name, (err, svc) => {
        if (err){
          if (!err.statusCode || err.statusCode != 404){
            return reject(err);
          }
        }
        return resolve(rc);
      });
    });
  }
  deleteDeployment(d){
    return new Promise((resolve, reject) => {
      console.log(`deleting deployment ${d.name}...`);
      this.k8s.deployments.delete(d.name, err => {
        if (err){
          if (!err.statusCode || err.statusCode != 404){
            return reject(err);
          }
        }
        return resolve(d);
      });
    })
  }
  deleteReplicationController(rc){
    return new Promise((resolve, reject) => {
      console.log(`deleting rc ${rc.name}...`);
      this.k8s.replicationControllers.delete(rc.name, err => {
        if (err){
          if (!err.statusCode || err.statusCode != 404){
            return reject(err);
          }
        }
        return resolve(rc);
      });
    })
  }
  deleteReplicationControllers(expired, cb){
    return new Promise((resolve, reject) => {
      async.eachLimit(expired, this.agentOptions.parallelism || 5, (rc, cb1) => {
          this.deleteService(rc)
            .then(rc => this.deleteIngress(rc))
            .then(rc => this.deleteReplicationController(rc))
            .then(rc => {
              console.log(`deleted ${rc.name}`);
              cb1(null, true);
            })
            .catch(err => {
              console.log(err);
              cb1(null, true);
            });
        }, err => {
          if (err){
            console.log('err1', err)
            return resolve(expired);
          }
          return resolve(expired);
        });
      });
  }
  deleteDeployments(expired, cb){
    return new Promise((resolve, reject) => {
      async.eachLimit(expired, this.agentOptions.parallelism || 5, (d, cb1) => {
        this.deleteDeployment(d)
            .then(d => {
              console.log(`deleted ${d.name}`);
              cb1(null, true);
            })
            .catch(err => {
              console.log(err);
              cb1(null, true);
            });
      }, err => {
        if (err){
          console.log('err1', err)
          return resolve(expired);
        }
        return resolve(expired);
      });
    });
  }
  poller() {
    this.getReplicationControllers()
      .then(expired => this.deleteReplicationControllers(expired))
      .then(expired => console.log(`deleted ${expired.length} builds from ${this.options.namespace} namespace`))
      .then(nothing => this.getDeployments())
      .then(expired => this.deleteDeployments(expired))
      .then(expired => console.log(`deleted ${expired.length} deployments from ${this.options.namespace} namespace`))
      .then(nothing => setTimeout(this.poller.bind(this), this.agentOptions.retention_interval))
      .catch(err => {
        console.log(err);
        setTimeout(this.poller.bind(this), this.agentOptions.retention_interval)
      })
  }
  audit(){
    const age = utils.tdelta('1d');
    this.getAllServices()
      .then(svcs => this.cleanupOrphanedObjects('ingresses', age, svcs))
      .then(svcs => {
        setTimeout(this.poller.bind(this), this.agentOptions.audit_interval);
      });
  }

  start(){
    this.audit();
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
