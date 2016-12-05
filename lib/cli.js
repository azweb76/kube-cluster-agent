'use strict'

const K8sClient = require('k8s-client');
const Retention = require('./retention');
const Monitor = require('./monitor');
const Notify = require('./notify');
const utils = require('./utils');
const url = require('url');

class Cli{
  constructor(options){
    this.options = options;
    const u = url.parse(options.url);
    if (!options.cluster_name){
      options.cluster_name = u.hostname + ' [' + options.namespace.join(', ') + ']';
    }
    const k8sOptions = {
      url: options.url,
      namespace: null,
      username: options.username,
      password: options.password,
      token: options.token,
      clientKey: options.key,
      clientCert: options.cert,
      caCert: options.ca_cert
    };
    this.allk8s = new K8sClient(k8sOptions);
    this.k8s = this.getK8sByNamespace(options);
    this._retention = Retention.createFromNamespaces(this);
    this._monitor = new Monitor(this);
    this._notify = new Notify(this);
  }
  getK8sByNamespace(options){
    const k8s = {};
    for(var ns of options.namespace){
      const k8sOptions = {
        url: options.url,
        namespace: ns,
        username: options.username,
        password: options.password,
        token: options.token,
        clientKey: options.key,
        clientCert: options.cert,
        caCert: options.ca_cert
      };
      k8s[ns] = new K8sClient(k8sOptions);
    }
    return k8s;
  }
  notify(msg, cb){
    this._notify.notify(msg, cb);
  }
  start(){
    this.exitOnSignal('SIGINT');
    this.exitOnSignal('SIGTERM');

    this._monitor.start();
    this._retention.each(x => x.start());

    const checkNames = this._monitor.checks.map(x => x.name).join(', ');
    this.notify({
      title: 'App Startup',
      message: `Cluster agent has started on ${this.options.cluster_name} cluster (checks=${checkNames}).`,
      color: 'good'
    }, () => {})
  }
  exitOnSignal(signal) {
    process.on(signal, function() {
      console.log('caught ' + signal + ', exiting');
      process.exit(0);
    });
  }
}

module.exports = exports = Cli;
