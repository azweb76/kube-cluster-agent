'use strict'

const http = require('http');

const async = require('async');
const utils = require('./utils');
const express = require('express');

class Api{
  constructor(agent){
    this.agent = agent;
    this.monitor = agent._monitor;
    this.options = agent.options;
  }
  healthcheck(req, res){

    const hasAlerts = Object.keys(this.monitor.alerts).length > 0;
    const status = !hasAlerts;

    var statusMessage = 'pageok';
    if (hasAlerts){
      statusMessage = 'One or more alerts present.'
    }

    res.send({
      'status': status,
      'statusMessage': statusMessage,
      'alerts': this.monitor.alerts
    });
  }
  getNodeStatus(node){
    const conditions = node.status.conditions;
    for(var condition of conditions){
      if (condition.type === 'Ready'){
        return (condition.status === 'True' ? 'online' : 'offline');
      }
    }
    return 'offline';
  }
  nodeHealth(node){
    return {
      name: node.metadata.name,
      status: this.getNodeStatus(node)
    };
  }
  capacity(req, res){
    var k8sclient = this.agent.allk8s;
    k8sclient.nodes.get((err, results) => {
      if (err) return res.send(500, {err});
      const nodes = results[0].items;
      k8sclient.pods.get((err, results) => {
        if (err) return res.status(500).send({err});
        const podCount = results[0].items.length;
        var maxPods = 0;

        for(var node of nodes){
          maxPods += parseInt(nodes[0].status.capacity.pods);
        }

        res.status(200).send({
          'nodes': nodes.map(this.nodeHealth.bind(this)),
          'stats': {
            'podsUsed': podCount,
            'maxPods': maxPods,
            'nodesUsed': (nodes.length == 0 ? 0 : Math.ceil(podCount /
              (maxPods / nodes.length)))
          }
        });
      });
    });
  }
  listen(){
    const self = this;
    const app = express();
    app.get('/', this.healthcheck.bind(this));
    app.get('/healthcheck.html', this.healthcheck.bind(this));
    app.get('/healthz', this.healthcheck.bind(this));
    app.get('/capacity', this.capacity.bind(this));
    // Listen on port 8000, IP defaults to 127.0.0.1
    app.listen(8080);
  }
}

module.exports = exports = Api;
