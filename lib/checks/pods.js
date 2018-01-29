'use strict'
const utils = require('../utils');

module.exports = exports = {
  name: 'pod-health',
  namespace: true,
  check: function(monitor, cb){
    monitor.k8s[this.namespace].pods.get((err, results) => {
      if (err) return cb(err);
      const pods = results[0].items;
      const badPods = [];
      const now = Date.now();
      const max_pod_pending = monitor.options.max_pod_pending;
      const max_pod_restarts = monitor.options.max_pod_restarts;

      const podSelector = monitor.options.pod_health_selector;
      const restarts = {};
      for (var pod of pods) {
        const labels = pod.metadata.labels || {};
        if (podSelector === null || utils.selectorsMatch(labels, podSelector)){
          const nodeName = pod.spec.nodeName || 'unknown';
          const annotations = pod.metadata.annotations || {};
          const notify = annotations.slackNotify || null;

          if(pod.status.containerStatuses !== undefined){
            for(var containerStatus of pod.status.containerStatuses){

              if (containerStatus.ready === false){
                const title = `${pod.metadata.name}:${containerStatus.name} on ${nodeName}`;

                for(var state of ['waiting','terminated']){
                  if (containerStatus.state && containerStatus.state[state]){
                    const w = containerStatus.state[state];

                    if (w.reason !== 'ContainerCreating'){
                      badPods.push({ title: `${pod.metadata.name}/${containerStatus.name} on ${nodeName}`,
                        value: `cause: ${w.reason}; ${w.message || ''}` })
                      break;
                    }
                  }
                }
                // else {
                //   if((now - Date.parse(pod.status.startTime)) > max_pod_pending){
                //     if (pod.status.containerStatuses && pod.status.containerStatuses.length > 0){
                //       badPods.push({ title: title, value: 'cause:' + JSON.stringify(containerStatus.state) });
                //     }
                //     else {
                //       badPods.push({ title: title, value: 'cause: likely waiting on space' });
                //     }
                //   }
                // }
              } else {
                restarts[`${pod.metadata.name}/${containerStatus.name}`] = containerStatus.restartCount;
              }
            }
          }
        }
      }

      if(this.podRestarts === undefined){
        this.podRestarts = {};
      }

      for(var restart_name in restarts){
        const restartCount = restarts[restart_name];
        if(restart_name in this.podRestarts){
          if ((restartCount - this.podRestarts[restart_name]) > max_pod_restarts){
            badPods.push({ title: restart_name, value: `cause: ${restartCount} restarts exceeded change threshold` });
          }
        }
      }
      this.podRestarts = restarts;

      if (badPods.length > 0){
        cb(null, { success: false, message: `${badPods.length} of ${pods.length} pods are not running`, items: badPods });
      } else {
        cb(null, { success: true, message: `${pods.length} pods running` });
      }
    });
  }
}
