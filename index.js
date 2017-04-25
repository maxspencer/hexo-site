var lambdeploy = require('lambdeploy');

exports.handler = lambdeploy.createHandler(function(workingDir, callback) {
    var Hexo = require('hexo');
    var hexo = new Hexo(workingDir, {});
    hexo.init({}).then(function() {
	hexo.call('generate', {}).then(callback).catch(callback);
    }).catch(callback);
});
