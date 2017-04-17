exports.handler = function(event, context, callback) {
    var fs = require('fs');
    var tar = require('tar');
    var zlib = require('zlib');
    var https = require('follow-redirects').https;
    var AWS = require('aws-sdk');
    var path = require('path');
    var async = require('async');
    var s3 = require('s3');
    var Hexo = require('hexo');

    var userAgent = 'maxspencer';
    
    var download = function(host, path, dest, cb) {
	var options = {
	    host: host,
	    path: path,
	    headers: {
		'User-Agent': userAgent
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
	}).on('error', function(err) {
	    if (cb) cb(err.message);
	});
    };

    var listDir = function(path) {
	var files = fs.readdirSync(path);
	async.map(files, function (f, cb) {
	    console.log(f);
	});
    };

    console.log(JSON.parse(event.Records[0].Sns.Message));

    var archivePath = '/repos/maxspencer/hexo-site/tarball/master';
    var tmpDir = '/tmp/hexo-site-extracted';
    var s3Region = 'eu-west-2';
    var s3Bucket = 'hexo-site-2';
    
    download('api.github.com', archivePath, tmpDir, function(err, data) {
	if (err) {
	    callback(err);
	    return;
	}
	var files = fs.readdirSync(tmpDir);
	var tmpBaseDir = path.join(tmpDir, files[0]);
	var tmpPublicDir = path.join(tmpBaseDir, '/public');
	var tmpNodeModules = path.join(tmpBaseDir, '/node_modules');
	var packageNodeModules = path.join(process.cwd(), '/node_modules');
	console.log('Temporary working directory is ' + tmpBaseDir);
	fs.unlink(tmpNodeModules, function() {
	    fs.symlink(packageNodeModules, tmpNodeModules, function(err) {
		if (err) {
		    callback(err);
		    return;
		}
		var hexo = new Hexo(tmpBaseDir, {});
		hexo.init({}).then(function() {
		    hexo.call('generate', {}).then(function() {
			console.log('Generated site files in ' + tmpPublicDir);
			var awsS3Client = new AWS.S3({ region: s3Region	});
			var s3Client = s3.createClient({ s3Client: awsS3Client });
			var uploader = s3Client.uploadDir({
			    localDir: tmpPublicDir,
			    deleteRemoved: true,				
			    s3Params: {
				Bucket: s3Bucket,
			    },
			});
			uploader.on('error', function(err) {
			    console.error("Unable to upload to s3: ", err.stack);
			    callback(err);
			});
			uploader.on('end', function() {
			    callback(null, "Uploaded to s3");
			});
		    }).catch(function(err) {
			callback(err);
		    });
		}).catch(function(err) {
		    callback(err);
		});
	    });
	});
    });
}
