'use strict';

const topLogPrefix = 'larvitlog: ' + __filename + ' - ';
const MessageHandler = require(__dirname + '/models/messageHandler.js');
const LUtils = require('larvitutils');
const App = require('larvitbase-api');
const fs = require('fs');

const lUtils = new LUtils();

class Logger {
	constructor(options) {
		options = options || {};
		options.log = options.log || new lUtils.Log();
		this.log = options.log;

		if (!options.fileStoragePath) {
			const err = new Error('File storage path not specified');
			this.log.warn(topLogPrefix + err.message);

			throw err;
		}

		if (!options.intercom) {
			const err = new Error('Intercom not specified');
			this.log.warn(topLogPrefix + err.message);

			throw err;
		}

		this.options = options;
	}

	async start() {
		const logPrefix = topLogPrefix + 'Logger.prototype.start() - ';

		if (!fs.existsSync(this.options.fileStoragePath)) {
			fs.mkdirSync(this.options.fileStoragePath);
		}

		this.log.info(logPrefix + '===--- Larvitlog starting ---===');

		this.app = new App({
			lBaseOptions: {httpOptions: this.options.port || 8001} // Listening port,
		});

		// Parse all incoming data as JSON
		this.app.middleware.splice(1, 0, (req, res, cb) => {
			if (req.method.toUpperCase() !== 'GET' && req.rawBody === undefined) {
				res.statusCode = 400;
				res.end('"Bad Request\nNo body provided"');
				this.log.verbose(logPrefix + 'No body provided.');

				return;
			}

			if (req.rawBody) {
				try {
					req.jsonBody = JSON.parse(req.rawBody.toString());
				} catch (err) {
					res.statusCode = 400;
					res.end('"Bad Request\nProvided body is not a valid JSON string"');
					this.log.verbose(logPrefix + 'Could not JSON parse incoming body. err: ' + err.message);

					return;
				}
			}

			cb();
		});

		await new Promise((resolve, reject) => {
			this.app.start(err => {
				if (err) return reject(err);
				this.log.info(logPrefix + 'Server up and running on port ' + this.app.lBase.httpServer.address().port);
				resolve();
			});
		});

		// Setup sockets
		this.io = require('socket.io')(this.app.lBase.httpServer);
		this.io.set('transports', ['polling', 'websocket']);

		// Create message handler
		this.messageHandler = new MessageHandler({
			io: this.io,
			fileStoragePath: this.options.fileStoragePath,
			intercom: this.options.intercom,
			exchangeName: this.options.exchangeName
		});

		// Provide the messageHandler and log instance in the req
		this.app.middleware.splice(1, 0, (req, res, cb) => {
			req.log = this.log;
			req.messageHandler = this.messageHandler;
			cb();
		});
	};

	async stop() {
		await new Promise((resolve, reject) => {
			this.app.lBase.httpServer.close(err => {
				if (err) return reject(err);
				resolve();
			});
		});
	};
};

module.exports = Logger;
