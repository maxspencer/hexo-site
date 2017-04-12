exports.handler = function( event, context, callback ) {
    console.log( "Running index.handlerhhhh" );
    console.log( "==================================");
    console.log( "event", event );
    var fs = require('fs');
    var tar = require('tar');
    var zlib = require('zlib');
    var https = require('follow-redirects').https;
    var AWS = require('aws-sdk');
    var path = require('path');
    var async = require('async');
    
    var download = function(host, path, dest, cb) {
	var options = {
	    host: host,
	    path: path,
	    headers: {
		'User-Agent': 'maxspencer'
	    }
	}
	var request = https.get(options, function(response) {
	    var decompress = zlib.createGunzip()
		.on('error', function(err) {
		    callback(err);
		});
	    var extractor = tar.Extract({path: dest})
		.on('error', function(err) { callback(err); })
		.on('end', cb);
	    response
		.pipe(decompress)
		.pipe(extractor);
	}).on('error', function(err) { // Handle errors
	    if (cb) cb(err.message);
	});
    };

    var listDir = function(path) {
	var files = fs.readdirSync(path);
	async.map(files, function (f, cb) {
	    console.log(f);
	});
    };

    download(
	'api.github.com',
	'/repos/maxspencer/hexo-site/tarball/master',
	'/tmp/hexo-site-extracted',
	function(err, data) {
	    if (err) {
		callback(err);
	    } else {
		var files = fs.readdirSync('/tmp/hexo-site-extracted');
		console.log(files);
		var tmpBaseDir = '/tmp/hexo-site-extracted' + '/' + files[0];
		var tmpNodeModules = tmpBaseDir + '/node_modules';
		console.log(tmpBaseDir);
		fs.unlink(tmpNodeModules, function() {
		    fs.symlinkSync(process.cwd() + '/node_modules', tmpBaseDir + '/node_modules');
		    //callback(null, 'Done');


		    var Hexo = require('hexo');
		    var hexo = new Hexo(tmpBaseDir, {});
		    hexo.init({}).then(function() {
			hexo.call('generate', {}).then(function() {
			    var tmpPublicDir = tmpBaseDir + '/public';
			    console.log(fs.readdirSync(tmpPublicDir));
			    var s3 = new AWS.S3();
			    s3.putObject({
				Bucket: 'hexo-site',
				Key: 'index.html',
				Body: fs.readFileSync(path.join(tmpPublicDir, "index.html"))
			    }, function(err, data){
				if (err) {
				    callback(err);
				} else {
				    callback(null, "Donee2");
				}				
			    });
			    //callback(null, 'Donee');
			}).catch(function(err) {
			    callback(err);
			});
		    }).catch(function(err) {
			callback(err);
		    });
		});
	    }
	}
    );
    
    /*
    var buildDir = '/tmp/hexo-build';
    var tmpConfig = '/tmp/_config.yml';
    var yaml = require('yaml-js');
    var config = yaml.load(fs.readFileSync('./_config.yml', { encoding: 'utf-8' }))
    config.public_dir = buildDir
    console.log(config);
    fs.writeFileSync(tmpConfig, yaml.dump(config))
    var Hexo = require('hexo');
    console.log( {debug: true, config: tmpConfig});
    var hexo = new Hexo(process.cwd(), {debug: true, config: tmpConfig});

    hexo.init({}).then(function() {
	hexo.call('generate', {}).then(function() {
	    var publicDir = path.resolve(buildDir);
	    var files = fs.readdirSync(publicDir);
	    var s3 = new AWS.S3();
	    async.map(files, function (f, cb) {
		console.log(f);
	    });
	    s3.putObject({
		Bucket: 'hexo-site',
		Key: 'index.html',
		Body: fs.readFileSync(path.join(publicDir, "index.html"))
	    }, function(err, data){
		callback(err, "success");		
	    });
	}).catch(function(err) {
	    callback(err);
	});
    }).catch(function(err) {
	callback(err);
    });
    //callback(null, process.execPath);
    */
}
