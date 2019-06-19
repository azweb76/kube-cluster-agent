#!/usr/bin/env node

'use strict'

const Cli = require('./lib/app');
const utils = require('./lib/utils');
const ArgumentParser = require('argparse').ArgumentParser;

var parser = new ArgumentParser({
  version: '0.0.1',
  addHelp:true,
  description: 'CICD cluster agent.'
});
parser.addArgument(
  [ '-u', '--url' ],
  {
    required: true,
    help: 'Url to the kubernetes cluster.'
  }
);

parser.addArgument(
  [ '-ns', '--namespace' ],
  {
    action: 'append',
    defaultValue: [],
    required: true,
    help: 'Kubernetes namespace(s).'
  }
);

parser.addArgument(
  [ '--sys-namespace' ],
  {
    defaultValue: 'kube-system',
    help: 'Kubernetes system namespace.'
  }
);

parser.addArgument(
  [ '-m', '--monitor' ],
  {
    action: 'append',
    defaultValue: [],
    help: 'Monitors to enable.'
  }
);

parser.addArgument(
  [ '--slack-url' ],
  {
    help: 'Url to a slack webhook.'
  }
);
parser.addArgument(
  [ '--slack-channel' ],
  {
    help: 'Slack channel name to send notifications.'
  }
);
parser.addArgument(
  [ '--notify-user' ],
  {
    defaultValue: '@here',
    help: 'Slack user to notify.'
  }
);
parser.addArgument(['--username'], {
  defaultValue: process.env.KUBE_USERNAME,
  help: 'Username used to login to cluster.'
});
parser.addArgument(['--password'], {
  defaultValue: process.env.KUBE_PASSWORD,
  help: 'Password used to login to cluster.'
});
parser.addArgument(['--token'], {
  defaultValue: process.env.KUBE_TOKEN,
  help: 'Token used to login to cluster.'
});
parser.addArgument(['--token-file'], {
  defaultValue: process.env.KUBE_TOKEN_FILE,
  help: 'Token file used to login to cluster.'
});
parser.addArgument(['--ca-cert'], { help: 'CA certificate used to access cluster.' });
parser.addArgument(['--cert'], { help: 'Client certificate used to login to cluster.' });
parser.addArgument(['--key'], { help: 'Client certificate key used to login to cluster.' });

parser.addArgument(['--pod-threshold'], { type: Number, help: 'Maximum pods in the namespace.' });

parser.addArgument(['--cluster-name'], { help: 'Name of the cluster used in notifications.' });
parser.addArgument(
  [ '-p', '--parallelism' ],
  {
    type: Number,
    defaultValue: 4,
    help: 'Number of parallel tasks.'
  }
);
parser.addArgument(
  [ '--pod-availability-threshold' ],
  {
    type: Number,
    defaultValue: 10,
    help: 'Minimum available pods threshold.'
  }
);
parser.addArgument(
  [ '--monitor-interval' ],
  {
    type: utils.tdelta,
    defaultValue: '1m',
    help: 'Interval to run monitor checks.'
  }
);
parser.addArgument(
  [ '--pod-health-selector' ],
  {
    type: utils.toSelector,
    defaultValue: null,
    help: 'Selector used to determine healthy pods.'
  }
);
parser.addArgument([ '--max-pod-pending' ], { type: utils.tdelta,
    defaultValue: '5m', help: 'Maximum duration a pod can be in a pending status.' }
);
parser.addArgument([ '--privileged' ], { action: 'storeTrue',
    defaultValue: false, help: 'Enable cluster-wide features.' }
);
parser.addArgument([ '--max-pod-restarts' ], { type: Number,
    defaultValue: 2, help: 'Maximum number a pod can restart within the monitor-interval.' }
);
parser.addArgument(
  '--retention-interval',
  {
    type: utils.tdelta,
    defaultValue: '5m',
    help: 'The interval (in ms) in which the retention process checks for expired builds.'
  }
);
parser.addArgument('--audit-interval',
  { type: utils.tdelta, defaultValue: '5d',
    help: 'The interval in which the retention process should audit objects (orphaned, etc).'
  }
);
parser.addArgument('--graphite-host',
  { help: 'Graphite host to publish heapster metrics.' }
);
parser.addArgument('--stats-interval',
  { type: utils.tdelta, defaultValue: '15s', help: 'Interval to push stats to graphite.' }
);
parser.addArgument('--graphite-prefix',
  { defaultValue: 'k8s', help: 'Graphite prefix.' }
);
parser.addArgument('--port',
  { defaultValue: 8080, help: 'API port to listen' }
);
var args = parser.parseArgs();

const cli = new Cli(args);
cli.start();
