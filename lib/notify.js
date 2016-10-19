'use strict'

const url   = require('url');
const https = require('https');
const async = require('async');
const utils = require('./utils');

class Notify{
  constructor(agent){
    this.agent = agent;
    this.k8s = agent.k8s;
    this.options = agent.options;
    this.alerts = {};
  }
  sendSlackInternal(msg, cb){
    const slackUrl = url.parse(this.options.slack_url);
    const postData = JSON.stringify(msg);

    const options = {
      hostname: slackUrl.hostname,
      port: 443,
      path: slackUrl.path,
      method: 'POST',
      headers: {
        'Content-Type': '',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    const req = https.request(options, (res) => {
      if(res.statusCode === 200){
        var d = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          d += chunk;
        });
        res.on('end', () => {
          cb(null, d);
        });
      }
      else {
        cb(new Error('unable to run load test [statusCode='+res.statusCode+']'))
      }
    });
    req.on('error', err => {
      cb(err);
    });
    req.write(postData);
    req.end();
  }
  sendSlack(msg, cb){
    if(this.options.slack_channel && this.options.slack_url){
      var itemsStr = '';
      if(msg.items && msg.items.length > 0){
        itemsStr = '\n\n'+msg.items.map(x => {
          return `  - *${x.title}*: ${x.value}`
        }).join('\n');
      }
      this.sendSlackInternal({
        username: 'Cluster Agent',
        channel: this.options.slack_channel,
        link_names: 1,
        attachments: [
          {
            'text': `${this.options.notify_user}: ${msg.message}${itemsStr}`,
            'title': msg.title,
            'color': msg.color || 'good',
            'footer': `reported from ${this.options.cluster_name}`,
            "mrkdwn_in": ["text", "pretext", "title"]
          }
        ]
      }, cb)
    } else {
      console.log(msg);
      cb(null);
    }
  }
  notify(msg, cb){
    this.sendSlack(msg, cb)
  }
}

module.exports = exports = Notify;
