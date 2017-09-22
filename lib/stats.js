'use strict'

const k8s = require('k8s-client');
const async = require('async');
const utils = require('./utils');
var net = require('net');
const util = require('util')

class StatsPublisher{
  constructor(agent){
    this.agent = agent;
    this.sysk8s = agent.sysk8s;
    this.allk8s = agent.allk8s;
    this.options = agent.options;
  }
  calculateNodeStats(stats){
    var nodesByDedicated = {};
    var byStats = stats.node_stats = {
      by_dedicated: nodesByDedicated
    };
    const options = this.options;
    const ts = Math.floor(Date.now()/1000);
    return new Promise((resolve, reject) => {
      this.allk8s.nodes.get((err, results) => {
        if (err){
          return reject(err);
        }
        let nodesByName = {};
        for(var item of results[0].items){
          var nodeStats = stats.nodes[item.metadata.name];
          if(nodeStats){
            let capacity = item.status.capacity;
            nodeStats.cpu_limit = parseInt(capacity.cpu);
            nodeStats.memory_limit = utils.toBytes(capacity.memory);
            nodeStats.cpu_usage_pct = nodeStats.cpu / nodeStats.cpu_limit;
            nodeStats.memory_usage_pct = nodeStats.memory / nodeStats.memory_limit;
            nodeStats.pod_limit = parseInt(capacity.pods);

            let podNodeStat = stats.pod_stats.by_node[item.metadata.name];
            nodeStats.pod_count = podNodeStat ? podNodeStat.count : 0;
            
            var dedicated = item.metadata.labels.dedicated || 'default';

            var statsByDedicated = nodesByDedicated[dedicated];
            if(statsByDedicated === undefined){
              statsByDedicated = nodesByDedicated[dedicated] = {
                cpu: 0,
                memory: 0,
                cpu_limit: 0,
                memory_limit: 0,
                cpu_usage_pct: 0.0,
                memory_usage_pct: 0.0,
                pod_limit: 0,
                pod_count: 0
              };
            }

            statsByDedicated.cpu += nodeStats.cpu;
            statsByDedicated.memory += nodeStats.memory;
            statsByDedicated.cpu_limit += nodeStats.cpu_limit;
            statsByDedicated.memory_limit += nodeStats.memory_limit;
            statsByDedicated.cpu_usage_pct = statsByDedicated.cpu / statsByDedicated.cpu_limit;
            statsByDedicated.memory_usage_pct = statsByDedicated.memory / statsByDedicated.memory_limit;
            statsByDedicated.pod_limit += nodeStats.pod_limit;
            statsByDedicated.pod_count += nodeStats.pod_count;
            statsByDedicated.pods_available = statsByDedicated.pod_limit - statsByDedicated.pod_count;
          }
        }
        resolve(stats)
      });
    });
  }
  groupPodStats(stats) {
    const options = this.options;
    const ts = Math.floor(Date.now()/1000);
    const pod_stats = stats.pod_stats;
    const node_stats = stats.node_stats;

    return new Promise((resolve, reject) => {
      this.allk8s.pods.get((err, results) => {
        if (err){
          return reject(err);
        }
        try{
          var by_namespace = pod_stats['by_namespace'] = {};
          var by_app = pod_stats['by_app'] = {};
          var by_node = pod_stats['by_node'] = {};

          function increment(byItems, name, subName, cnt){
            if(cnt === undefined){
              cnt = 1
            }
            if(!byItems[name]){
              byItems[name] = {}
            }
            if(!byItems[name][subName])
            {
              byItems[name][subName] = cnt
            }
            else {
              byItems[name][subName] += cnt
            }
          }

          for(var item of results[0].items){
            var podName = item.metadata.name;
            var podStat = stats.pods[podName] || {
              cpu: 0, memory: 0
            };
            increment(by_namespace, item.metadata.namespace, 'count');

            var restartCount = 0;
            if(item.status){
              var phase = item.status.phase.toLowerCase();
              increment(by_namespace, item.metadata.namespace, phase);
              if(item.status.containerStatuses){
                for(var containerStatus of item.status.containerStatuses){
                  restartCount += containerStatus.restartCount;
                }
              }
              increment(by_namespace, item.metadata.namespace, 'restarts', restartCount);
              increment(by_namespace, item.metadata.namespace, 'cpu', podStat.cpu);
              increment(by_namespace, item.metadata.namespace, 'memory', podStat.memory);
            }

            if (item.metadata.labels && item.metadata.labels.app){
              increment(by_app, item.metadata.labels.app, 'count');
              increment(by_app, item.metadata.labels.app, phase);
              increment(by_app, item.metadata.labels.app, 'restarts', restartCount);
              increment(by_app, item.metadata.labels.app, 'cpu', podStat.cpu);
              increment(by_app, item.metadata.labels.app, 'memory', podStat.memory);

              let by_app_stats = by_app[item.metadata.labels.app]
              by_app_stats['avg_memory'] = by_app_stats.count > 0 ? by_app_stats.memory / by_app_stats.count : 0;
              by_app_stats['avg_cpu'] = by_app_stats.count > 0 ? by_app_stats.cpu / by_app_stats.count : 0;
            }

            if(item.spec.nodeName){
              increment(by_node, item.spec.nodeName, 'count');
              increment(by_node, item.spec.nodeName, phase);
              increment(by_node, item.spec.nodeName, 'restarts', restartCount);
              increment(by_node, item.spec.nodeName, 'cpu', podStat.cpu);
              increment(by_node, item.spec.nodeName, 'memory', podStat.memory);
            }
          }

          resolve(stats);
        } catch (ex) {
          console.log(ex);
          reject(ex);
        }
      });
    });
  }
  publishStats(stats){
    const self = this;
    function appendMetrics(obj, metrics, ts, path){
      if (typeof(obj) == 'object'){
        for(var key in obj){
          let metricName = key.replace(/[\.]/g,'_');
          appendMetrics(obj[key], metrics, ts, path.concat(metricName));
        }
      }
      else {
        metrics.push(`${path.join('.')} ${obj} ${ts}`);
      }
    }
    return new Promise((resolve, reject) => {
      let metrics = [];
      appendMetrics(stats.pods, metrics, stats.ts, ['pods']);
      appendMetrics(stats.nodes, metrics, stats.ts, ['nodes']);
      appendMetrics(stats.pod_stats, metrics, stats.ts, ['stats']);
      appendMetrics(stats.node_stats, metrics, stats.ts, ['node_stats']);

      let options = self.options;
      let prefix = options.graphite_prefix;
      var socket = net.createConnection(2003, options.graphite_host, err => {
          console.log('sending pod graphite data...');
          socket.write(prefix + '.' + metrics.join('\n'+prefix+'.') + '\n');
          socket.end();
          resolve(stats);
      });
    });
  }
  generateStats(cb) {
    const self = this;
    const stats ={
      pods: {},
      nodes: {},
      node_stats: {},
      pod_stats: {},
      ts: Math.floor(Date.now()/1000)
    } 
    self.generatePodStats(stats)
      .then(self.groupPodStats.bind(self))
      .then(self.generateNodeStats.bind(self))
      .then(self.calculateNodeStats.bind(self))
      .then(self.publishStats.bind(self))
      .then(stats => {
        cb(null);
      })
      .catch(err => {
        console.error(err);
        cb(null);
      });
  }
  generatePodStats(stats) {
    var self = this;
    const options = this.options;
    return new Promise((resolve, reject) => {
      this.sysk8s.services.get('http:heapster:/proxy/apis/metrics/v1alpha1/pods', (err, results) => {
        if (err){
          return reject(err);
        }
        try{
          var podStats = {};
          for(var item of results.items){
            const name = `${options.graphite_prefix}.pods.${item.metadata.namespace}.${item.metadata.name.replace(/[\.]/g,'_')}`;
            var podTotals = stats.pods[item.metadata.name] = {
              cpu: 0,
              memory: 0
            };
            for(var container of item.containers){
              var cpu = utils.toMicroCores(container.usage.cpu);
              var memory = utils.toBytes(container.usage.memory);

              podTotals.cpu += cpu;
              podTotals.memory += memory;
              
            }
          }
          resolve(stats);
        } catch (ex) {
          reject(ex);
        }
      });
    });
  }
  generateNodeStats(stats){
    const options = this.options;
    return new Promise((resolve, reject) => {
      this.sysk8s.services.get('http:heapster:/proxy/apis/metrics/v1alpha1/nodes', (err, results) => {
        if (err){
          return reject(err);
        }
        for(var item of results.items){
          var cpu = utils.toMicroCores(item.usage.cpu);
          var memory = utils.toBytes(item.usage.memory);
          stats.nodes[item.metadata.name] = {
            cpu: cpu,
            memory: memory
          };
        }
        resolve(stats);
      });
    });
  }
  podPoller() {
    this.generateStats(err => {
      if(err){
        console.log(err);
      }
      setTimeout(this.podPoller.bind(this), this.options.stats_interval);
    });
  }
  start(){
    if(this.options.graphite_host){
      this.podPoller();
    }
    else {
      console.log('graphite host not specified. not sending stats')
    }
  }
}

module.exports = exports = StatsPublisher;
