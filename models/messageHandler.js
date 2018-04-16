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
	'default':	null,
}, function (err, warning) {
	if (warning) log.warn(logPrefix + warning);

	if ( ! exports.options) {
		throw new Error('Options not set!');
	}

	if ( ! exports.options.io) {
		throw new Error('Io not present in options');
	}

	if ( ! exports.options.fileStoragePath) {
		throw new Error('File path not present in options');
	}

	exports.options.io.on('connection', function () {
		log.verbose(topLogPrefix + 'Got a new connection!');
	});
});

function handleMessage(msg, cb) {
	const logPrefix	= topLogPrefix + 'SaveMessageToFile() - ',
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
		exports.options.io.sockets.emit('message', msg);
		cb();
	});

	async.series(tasks, cb);
};

function formatMessage(msg) {
	return moment(msg.date).format('YYYY-MM-DD HH:mm:ss.SSSS') + ' - ' + msg.sentBy + ' - ' + msg.level + ': ' + msg.message;
}

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
}

exports.handleMessage	= handleMessage;
exports.formatMessage	= formatMessage;
exports.getData	= getData;