exports.handler = function(event, context, callback) {
    var fs = require('fs');
    var tar = require('tar');
    var zlib = require('zlib');
    var https = require('follow-redirects').https;
    var AWS = require('aws-sdk');
    var path = require('path');
    var url = require('url');
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

    var message = JSON.parse(event.Records[0].Sns.Message);
    console.log('Message: ' + JSON.stringify(message, null, 2));

    if (message.pusher === undefined) {
	console.log('Not a push event, no build triggered');
	callback(null, 'No build');
	return;
    }

    var archiveFormat = 'tarball';

    var buildDir = 'public';
    var s3Region = 'eu-west-2';
    var s3Bucket = 'hexo-site-2';

    var archiveUrl = url.parse(
	message.repository.archive_url
	    .replace('{archive_format}', archiveFormat)
	    .replace('{/ref}', '/' + message.ref)
    );
    console.log('Archive URL is ' + url.format(archiveUrl));
    
    var tmpDir = path.join('/tmp', message.repository.name + '-' + message.after);
    console.log('Download directory is ' + tmpDir);    
    
    download(archiveUrl.host, archiveUrl.path, tmpDir, function(err, data) {
	if (err) {
	    callback(err);
	    return;
	}
	var files = fs.readdirSync(tmpDir);
	var tmpBaseDir = path.join(tmpDir, files[0]);
	var tmpBuildDir = path.join(tmpBaseDir, buildDir);
	var tmpNodeModules = path.join(tmpBaseDir, 'node_modules');
	var packageNodeModules = path.join(process.cwd(), 'node_modules');
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
			console.log('Generated site files in ' + tmpBuildDir);
			var awsS3Client = new AWS.S3({ region: s3Region	});
			var s3Client = s3.createClient({ s3Client: awsS3Client });
			var uploader = s3Client.uploadDir({
			    localDir: tmpBuildDir,
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
