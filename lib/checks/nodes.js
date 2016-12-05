module.exports = exports = {
  name: 'nodes-online',
  privileged: true,
  check: function(monitor, cb){
    monitor.allk8s.nodes.get((err, results) => {
      if (err){
        if (err.statusCode == 403){
          return cb(null, { success: false, message: 'Agent does not have access to monitor nodes. Disabling.', items: [] });
        }
        return cb(err);
      }
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
