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
    var s3 = require('s3');
    
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

    console.log(JSON.parse(event.Records[0].Sns.Message));

    var tmpDir = '/tmp/hexo-site-extracted'
    download(
	'api.github.com',
	'/repos/maxspencer/hexo-site/tarball/master',
	tmpDir,
	function(err, data) {
	    if (err) {
		callback(err);
	    } else {
		var files = fs.readdirSync(tmpDir);
		console.log(files);
		var tmpBaseDir = tmpDir + '/' + files[0];
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
			    var awsS3Client = new AWS.S3({
				region: 'eu-west-2'
			    });
			    
			    /*
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
			    */
			 
			    var client = s3.createClient({
				s3Client: awsS3Client,
			    });

			    var params = {
				localDir: tmpPublicDir,
				deleteRemoved: true,				
				s3Params: {
				    Bucket: 'hexo-site-2',
				},
			    };
			    var uploader = client.uploadDir(params);
			    uploader.on('error', function(err) {
				console.error("unable to sync:", err.stack);
				callback(err);
			    });
			    uploader.on('end', function() {
				callback(null, "Done uploading");
			    });
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
