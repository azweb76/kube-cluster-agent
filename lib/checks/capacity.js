module.exports = exports = {
  name: 'pod-capacity',
  namespace: true,
  check: function(monitor, cb){
    monitor.getMaxPods((err, podLimit) => {
      var k8sclient = monitor.allk8s;
      if (this.namespace && monitor.k8s[this.namespace]){
        k8sclient = monitor.k8s[this.namespace];
      }
      k8sclient.pods.get((err, results) => {
        if (err) return cb(err);
        const podCount = results[0].items.length;
        const podAvailable = podLimit - podCount;
        if (podLimit == 0 || (podAvailable < monitor.options.pod_availability_threshold)){
          cb(null, { success: false, message: `Cluster capacity warning with ${podAvailable} available.`, items: [
            { title: 'Maximum Pods', value: podCount },
            { title: 'Available Pods', value: podAvailable }
          ] });
        } else {
          cb(null, { success: true, message: `${podAvailable} pods available` });
        }
      });

    });
  }
}
