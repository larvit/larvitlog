'use strict';

const topLogPrefix = require('winston').appLogPrefix + __filename + ' - ';
const readLastLines = require('read-last-lines');
const moment = require('moment');
const path = require('path');
const log = require('winston');
const fs = require('fs');

class MessageHandler {
	constructor(options) {
		options = options || {};

		if (!options.io) {
			const err = new Error('Io not present in options');
			log.error(topLogPrefix + err.message);
			throw err;
		}

		if (!options.fileStoragePath) {
			const err = new Error('File path not present in options');
			log.error(topLogPrefix + err.message);
			throw err;
		}

		if (!options.intercom) {
			const err = new Error('Intercom not set');
			log.error(topLogPrefix + err.message);
			throw err;
		}

		this.io = options.io;
		this.fileStoragePath = options.fileStoragePath;
		this.intercom = options.intercom;
		this.exchangeName = options.exchangeName || 'larvitlog';

		this.io.on('connection', () => {
			log.verbose(topLogPrefix + 'Got a new connection!');
		});
	}

	handleMessage(msg) {
		return new Promise((resolve, reject) => {
			const logPrefix = topLogPrefix + 'handleMessage() - ';
			const filename = 'messages_' + moment().format('YYYY-MM-DD') + '.txt';

			log.debug(logPrefix + 'Saving and emitting message: ' + JSON.stringify(msg));

			if (!fs.existsSync(this.fileStoragePath + '/' + filename)) {
				fs.writeFileSync(this.fileStoragePath + '/' + filename, '');
			}

			const str = JSON.stringify(msg) + '\n';
			fs.appendFileSync(this.fileStoragePath + '/' + filename, str);

			this.io.sockets.emit(msg.emitType || 'message', msg);

			const sendObj = {
				action: msg.emitType || 'message',
				params: {
					message: msg
				}
			};

			this.intercom.send(sendObj, {exchange: this.exchangeName}, err => {
				if (err) return reject(err);
				resolve();
			});
		});
	};

	getData(options) {
		return new Promise(resolve => {
			const logPrefix = topLogPrefix + 'getData() - ';
			const filename = 'messages_' + moment().format('YYYY-MM-DD') + '.txt';
			let result = [];

			if (!fs.existsSync(path.join(this.fileStoragePath, filename))) {
				return resolve(result);
			}

			function readAllFromFile(file) {
				return new Promise((resolve) => {
					const lineReader = require('readline').createInterface({
						input: fs.createReadStream(file)
					});

					lineReader.on('line', line => {
						result.push(line);
					});

					lineReader.on('err', err => {
						log.warn(logPrefix + 'Error reading file "' + file + ', err: ' + err.message);
					});

					lineReader.on('close', () => {
						resolve(result.join('\n'));
					});
				});
			}

			const limit = Number(options.limit);
			const levels = options.levels;
			const file = path.join(this.fileStoragePath, filename);
			const readFunction = isNaN(limit) ? readAllFromFile : readLastLines.read;

			readFunction(file, limit)
				.then(lines => {
					result = lines
						.split('\n')
						.filter(line => !!line)
						.map(line => {
							if (line) return JSON.parse(line);
						})
						.filter(logEntry => {
							if (levels && levels.length && logEntry.metadata && logEntry.metadata.level) {
								return levels.includes(logEntry.metadata.level);
							} else {
								return true;
							}
						});
				})
				.catch(err => {
					log.warn(logPrefix + 'Error reading log file: "' + file + '", err: ' + err.message);
				})
				.finally(() => {
					resolve(result);
				});
		});
	};
};


module.exports = MessageHandler;
