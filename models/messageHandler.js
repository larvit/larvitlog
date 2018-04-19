'use strict';

const topLogPrefix	= require('winston').appLogPrefix + __filename + ' - ',
	checkKey	= require('check-object-key'),
	moment	= require('moment'),
	async	= require('async'),
	log	= require('winston'),
	fs	= require('fs');

checkKey({
	'obj':	exports,
	'objectKey':	'options',
	'default':	null
}, function (err, warning) {
	if (warning) log.warn(logPrefix + warning);

	if ( ! exports.options.io) {
		const err = new Error('Io not present in options');
		log.error(logPrefix + err.message);
		throw err;
	}

	if ( ! exports.options.fileStoragePath) {
		const err = new Error('File path not present in options');
		log.error(logPrefix + err.message);
		throw err;
	}

	if ( ! exports.options.intercom) {
		const err = new Error('Intercom not set');
		log.error(logPrefix + err.message);
		throw err;
	}

	exports.options.io.on('connection', function () {
		log.verbose(logPrefix + 'Got a new connection!');
	});
});

function handleMessage(msg, cb) {
	const logPrefix	= topLogPrefix + 'handleMessage() - ',
		tasks	= [],
		filename	= 'messages_' + moment().format('YYYY-MM-DD') + '.txt';

	log.debug(logPrefix + 'Saving and emitting message: ' + JSON.stringify(msg));

	if ( ! fs.existsSync(exports.options.fileStoragePath + '/' + filename)) {
		tasks.push(function (cb) {
			fs.writeFile(exports.options.fileStoragePath + '/' + filename, '', cb);
		});
	}

	tasks.push(function (cb) {
		const str = JSON.stringify(msg) + '\n';
		fs.appendFile(exports.options.fileStoragePath + '/' + filename, str, cb);
	});

	tasks.push(function (cb) {
		exports.options.io.sockets.emit(msg.emitType || 'message', msg);
		cb();
	});

	tasks.push(function (cb) {
		const sendObj = {
			'action': msg.emitType || 'message',
			'params': {
				'message': msg
			}
		};

		exports.options.intercom.send(sendObj, {'exchange': exports.exchangeName}, cb);
	});

	async.series(tasks, cb);
};

function formatMessage(msg) {
	return moment(msg.date).format('YYYY-MM-DD HH:mm:ss.SSSS') + ' - ' + msg.sentBy + ' - ' + msg.level + ': ' + msg.message;
};

function getData(options, cb) {
	const logPrefix = topLogPrefix + 'getData() - ',
		filename	= 'messages_' + moment().format('YYYY-MM-DD') + '.txt',
		result	= [];

	if (fs.existsSync(exports.options.fileStoragePath + '/' + filename)) {
		const lineReader = require('readline').createInterface({
			input: fs.createReadStream(exports.options.fileStoragePath + '/' + filename)
		});

		lineReader.on('line', function (line) {
			try {
				result.push(JSON.parse(line));
			} catch (err) {
				log.warn(logPrefix + 'Could not parse json from file "' + filename + '", line: ' + line);
			}
		});

		lineReader.on('close', function () {
			cb(null, result);
		});
	} else {
		cb(null, result);
	}
};

exports.exchangeName	= 'larvitlog';
exports.handleMessage	= handleMessage;
exports.formatMessage	= formatMessage;
exports.getData	= getData;