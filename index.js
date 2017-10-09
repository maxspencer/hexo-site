var lambdeploy = require('lambdeploy');

exports.handler = lambdeploy.createHandler(function(workingDir, callback) {
    var path = require('path');
    var Hexo = require('hexo');
    var hexo = new Hexo(workingDir, {});
    hexo.init({}).then(function() {
	hexo.call('generate', {}).then(function() {
	    callback(null, path.join(workingDir, 'public'));
	}).catch(callback);
    }).catch(callback);
});
