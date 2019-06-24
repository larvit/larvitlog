'use strict';

const Logger = require(__dirname + '/../index.js');
const freeport = require('freeport');
const Intercom = require('larvitamintercom');
const request = require('request-promise');
const assert = require('assert');
const LUtils = require('larvitutils');
const sinon = require('sinon');
const async = require('async');

const lUtils = new LUtils();
const log = new lUtils.Log('warn');

const exchangeName = 'larvitlog';

let amqpConfig;
let intercom;
let httpPort;
let httpUrl;
let clock;

async function sendLogMessage(url, message, level) {
	const reqOptions = {
		url,
		json: true,
		body: {
			message,
			emitType: 'message',
			metadata: {
				level
			}
		}
	};

	await request.post(reqOptions);
}

before(function (done) {
	const tasks = [];

	let confFile;

	if (process.env.AMQP_CONFFILE === undefined) {
		confFile = __dirname + '/../config/amqp_test.json';
	} else {
		confFile = __dirname + '/../config/' + process.env.AMQP_CONFFILE;
	}

	log.verbose(`AMQP config file:"${confFile}"`);

	amqpConfig = require(confFile);
	log.verbose(`AMQP config: ${JSON.stringify(amqpConfig)}`);

	intercom = new Intercom(amqpConfig.default);

	// Get free port
	tasks.push(function (cb) {
		freeport(function (err, port) {
			httpPort = port;
			httpUrl = `http://localhost:${port}`;
			cb(err);
		});
	});

	async.series(tasks, done);
});

afterEach(function (done) {
	sinon.restore();
	if (clock) clock.restore();
	done();
});

describe('Logger - get existing log messages', function () {
	let logger;

	beforeEach(async function () {
		// Return date so that our testdata file is loaded
		clock = sinon.useFakeTimers(new Date('2019-06-06').getTime());

		logger = new Logger({
			intercom,
			log,
			port: httpPort,
			fileStoragePath: __dirname + '/testdata'
		});

		await logger.start();
	});

	afterEach(async function () {
		await logger.stop();
	});

	it('should get all messages', async function () {
		// Get all messages
		const response = JSON.parse(await request.get(`${httpUrl}/getMessages`));

		// Check result
		assert.equal(response.length, 4);
		assert.deepStrictEqual(response[0], {
			emitType: 'message',
			message: 'An info message',
			metadata: {
				level: 'info'
			},
			timestamp: '2019-06-06T07:07:13.133Z'
		});
		assert.deepStrictEqual(response[1], {
			emitType: 'message',
			message: 'A warning message',
			metadata: {
				level: 'warn'
			},
			timestamp: '2019-06-06T07:07:14.131Z'
		});
		assert.deepStrictEqual(response[2], {
			emitType: 'message',
			message: 'An error message',
			metadata: {
				level: 'error'
			},
			timestamp: '2019-06-06T07:07:15.131Z'
		});
		assert.deepStrictEqual(response[3], {
			emitType: 'message',
			message: 'A super warning message',
			metadata: {
				level: 'super-warn'
			},
			timestamp: '2019-06-06T07:07:16.131Z'
		});
	});

	it('should get last messages with limit', async function () {
		// Get all messages
		const response = JSON.parse(await request.get(`${httpUrl}/getMessages?limit=1`));

		// Check result
		assert.equal(response.length, 1);
		assert.deepStrictEqual(response[0], {
			emitType: 'message',
			message: 'A super warning message',
			metadata: {
				level: 'super-warn'
			},
			timestamp: '2019-06-06T07:07:16.131Z'
		});
	});

	it('should get messages of only certain levels', async function () {
		// Get warn and error messages
		const response = JSON.parse(await request.get(`${httpUrl}/getMessages?level=warn&level=error`));

		// Check result
		assert.equal(response.length, 2);
		assert.deepStrictEqual(response[0], {
			emitType: 'message',
			message: 'A warning message',
			metadata: {
				level: 'warn'
			},
			timestamp: '2019-06-06T07:07:14.131Z'
		});
		assert.deepStrictEqual(response[1], {
			emitType: 'message',
			message: 'An error message',
			metadata: {
				level: 'error'
			},
			timestamp: '2019-06-06T07:07:15.131Z'
		});
	});

	it('should get messages of only certain levels and with limit', async function () {
		// Get warn and error messages
		const response = JSON.parse(await request.get(`${httpUrl}/getMessages?level=super-warn&limit=3`));

		// Check result
		assert.equal(response.length, 1);
		assert.deepStrictEqual(response[0], {
			emitType: 'message',
			message: 'A super warning message',
			metadata: {
				level: 'super-warn'
			},
			timestamp: '2019-06-06T07:07:16.131Z'
		});
	});
});

describe('Logger - log new message', function () {
	let logger;

	beforeEach(async function () {
		// Fake date so that we can remove log file
		clock = sinon.useFakeTimers(new Date('2019-06-07T13:37:00.000Z').getTime());

		logger = new Logger({
			intercom,
			log,
			port: httpPort,
			fileStoragePath: __dirname + '/testdata'
		});

		await logger.start();
	});

	afterEach(async function () {
		await logger.stop();
	});

	it('should log a message and get it', async function () {
		// Log message
		await sendLogMessage(`${httpUrl}/broadcastMessage`, 'hey!', 'info');

		// Get message
		const response = JSON.parse(await request.get(`${httpUrl}/getMessages?limit=1`));

		// Check result
		assert.equal(response.length, 1);
		assert.deepStrictEqual(response[0], {
			emitType: 'message',
			message: 'hey!',
			metadata: {
				level: 'info'
			},
			timestamp: '2019-06-07T13:37:00.000Z'
		});
	});

	it('should broadcast on intercom when logging message', function (done) {
		// Subscribe to log exchange
		intercom.subscribe({ exchange: exchangeName }, function (message, ack) {
			ack();
			assert.strictEqual(message.action, 'message');
			assert.strictEqual(message.params.message.emitType, 'message');
			assert.strictEqual(message.params.message.message, 'hey!');
			assert.strictEqual(message.params.message.timestamp, '2019-06-07T13:37:00.000Z');
			assert.strictEqual(message.params.message.metadata.level, 'info');
			done();
		}, function (err) {
			if (err) throw err;

			// Log message
			sendLogMessage(`${httpUrl}/broadcastMessage`, 'hey!', 'info');
		});
	});
});
