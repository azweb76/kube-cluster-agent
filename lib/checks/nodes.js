module.exports = exports = {
  name: 'nodes-online',
  check: function(monitor, cb){
    monitor.k8s[this.namespace].nodes.get((err, results) => {
      if (err) return cb(err);
      const failedNodes = [];
      const nodes = results[0].items;
      for (var node of nodes) {
        for (var condition of node.status.conditions){
          if (condition.type == 'Ready'){
            if (condition.status != 'True'){
              failedNodes.push({title: node.metadata.name, value: condition.reason});
            }
          }
        }
      }
      if (failedNodes.length > 0){
        cb(null, { success: false, message: 'One or more nodes are not in a Ready status.', items: failedNodes });
      } else {
        cb(null, { success: true, message: `${nodes.length} nodes online` });
      }
    });
  }
}
