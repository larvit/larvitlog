'use strict';

const	topLogPrefix	= 'larvitlog: ' + __filename + ' - ',
	messageHandler	= require(__dirname + '/models/messageHandler.js'),
	ArgParser	= require('argparse').ArgumentParser,
	async	= require('async'),
	App	= require('larvitbase-api'),
	log	= require('winston'),
	fs	= require('fs'),
	parser = new ArgParser({
		'addHelp':	true, // -h was reserved for help so had to disable :/
		'description':	'larvitmessages example'
	});

parser.addArgument(['-cd', '--configDir'], {'help': '/path/to/dir/with/config/files'});
parser.addArgument(['-fp', '--filePath'], {'help': '/path/to/files/are/stored'});
parser.addArgument(['-hp', '--httpPort'], {'help': '8080'});

// https://github.com/uxitten/polyfill/blob/master/string.polyfill.js
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart
if ( ! String.prototype.padStart) {
	String.prototype.padStart = function padStart(targetLength, padString) {
		targetLength	= targetLength >> 0; // Truncate if number or convert non-number to 0;
		padString	= String((typeof padString !== 'undefined' ? padString : ' '));
		if (this.length > targetLength) {
			return String(this);
		} else {
			targetLength	= targetLength - this.length;
			if (targetLength > padString.length) {
				padString += padString.repeat(targetLength / padString.length); //append to original to ensure we are longer than needed
			}
			return padString.slice(0, targetLength) + String(this);
		}
	};
}

function Logger(options) {
	const	that	= this;

	that.options	= options;

	if ( ! that.options)	that.options	= {};
};

Logger.prototype.start = function (cb) {
	const	logPrefix	= topLogPrefix + 'Logger.prototype.start() - ',
		that	= this,
		tasks	= [];

	if ( ! cb) cb = function () {};

	if ( ! that.options.app.fileStoragePath) {
		const	err	= new Error('File storage path not specified');
		log.warn(logPrefix + err.message);
		return cb(err);
	}

	if ( ! fs.existsSync(that.options.app.fileStoragePath)) {
		tasks.push(function (cb) {
			fs.mkdir(that.options.app.fileStoragePath, function (err) {
				let e = null;

				if (err) {
					e	= new Error('Failed to create directory "' + that.options.app.fileStoragePath + '": ' + err.message);
					log.warn(logPrefix + e.message);
				}

				return cb(e);
			});
		});
	}

	tasks.push(function (cb) {
		log.info(logPrefix + '===--- Larvitlog starting ---===');

		that.app = new App({
			'lBaseOptions': {'httpOptions': that.options.lBaseOptions.port || 8001}, // Listening port,
		});

		// Parse all incoming data as JSON
		that.app.middleware.splice(1, 0, function (req, res, cb) {

			if (req.method.toUpperCase() !== 'GET' && req.rawBody === undefined) {
				res.statusCode	= 400;
				res.end('"Bad Request\nNo body provided"');
				log.verbose(logPrefix + 'No body provided.');
				return;
			}

			if (req.rawBody) {
				try {
					req.jsonBody	= JSON.parse(req.rawBody.toString());
				} catch (err) {
					res.statusCode	= 400;
					res.end('"Bad Request\nProvided body is not a valid JSON string"');
					log.verbose(logPrefix + 'Could not JSON parse incoming body. err: ' + err.message);
					return;
				}
			}

			cb();
		});

		that.app.start(function (err) {
			if (err) return cb(err);
			log.info(logPrefix + 'Server up and running on port ' + that.app.lBase.httpServer.address().port);
			cb();
		});
	});

	// setup sockets
	tasks.push(function (cb) {
		that.io = require('socket.io')(that.app.lBase.httpServer);
		that.io.set('transports', ['websocket']);

		messageHandler.options = {
			'io': that.io,
			'fileStoragePath': that.options.app.fileStoragePath
		};

		cb();
	});

	async.series(tasks, cb);
};

Logger.prototype.stop = function (cb) {
	const that = this;
	that.app.httpServer.close(cb);
};

exports = module.exports = Logger;

// Running from console
if (require.main === module) {
	const	args	= parser.parseArgs();

	let	options,
		logger,
		cd;

	if (args.configDir) {
		console.log('Looking for config files in "' + args.configDir + '"');
		cd	= args.configDir;
	} else if (args.filePath  && args.httpPort) {
		options = {
			'lBaseOptions': args.httpPort,
			'app': args.filePath
		};
		console.log('Using configuration options from arguments');
	} else {
		cd	= __dirname + '/config';
		console.log('Looking for config files in "' + cd + '"');
	}

	if (cd && fs.existsSync(cd)) {
		options = {
			'lBaseOptions':	fs.existsSync(cd + '/server.json') ? require(cd + '/server.json') : null,
			'app':	fs.existsSync(cd + '/app.json') ? require(cd + '/app.json') : null,
			'log':	fs.existsSync(cd + '/log.json') ? require(cd + '/log.json') : null,
		};
	}

	// íf log not configured, try to look for log config file
	if ( options && ! options.log) {
		if (fs.existsSync(__dirname + '/config')) {
			if (fs.existsSync(__dirname + '/config/log.json')) {

			} else if (fs.existsSync(__dirname + '/config/log.json_example')) {

			} else {
				// no log config found, add config logging
				options.log = {
					'Console': {
						'colorize':	true,
						'timestamp':	true,
						'level':	'verbose',
						'json':	false,
						'handleExceptions':	true,
						'humanReadableUnhandledException': true
					}
				};
			}
		}
	}

	if (options && options.log) {
		// Add support for daily rotate file and elasticsearch
		log.transports.DailyRotateFile	= require('winston-daily-rotate-file');
		log.transports.Elasticsearch	= require('winston-elasticsearch');

		// Handle logging from config file
		log.remove(log.transports.Console);
		if (options.log !== undefined) {
			for (const logName of Object.keys(options.log)) {
				if (typeof options.log[logName] !== Array) {
					options.log[logName] = [options.log[logName]];
				}

				for (let i = 0; options.log[logName][i] !== undefined; i ++) {
					log.add(log.transports[logName], options.log[logName][i]);
				}
			}
		}
	}

	if (options) {
		logger	= new Logger(options);
		logger.start(function (err) {
			if (err) throw err;
		});
	} else {
		console.log('Invalid or insufficient parameters');
		process.exit(1);
	}
}