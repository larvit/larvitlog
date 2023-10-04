'use strict';

const topLogPrefix = __filename + ' - ';

function broadcastMessage(req, res, cb) {
	const log = req.log;
	const logPrefix = topLogPrefix + 'broadcastMessage() - ';
	const message = {};

	log.debug(logPrefix + 'rawBody: ' + req.rawBody);

	if (req.method.toUpperCase() !== 'POST') {
		log.verbose(topLogPrefix + 'Got request with unallowed method: "' + req.method + '", query: "' + req.urlParsed.href + '"');
		res.statusCode = 405;
		res.data = '405 Method Not Allowed\nAllowed methods: POST';

		return cb();
	}

	res.statusCode = 200;
	res.data = { message: 'OK' };

	if (!req.jsonBody) {
		res.statusCode = 400;
		res.data = {message: 'Bad Request, no body' };

		return cb();
	}

	if (!req.jsonBody.message || req.jsonBody.message === '') {
		res.statusCode = 400;
		res.data = {message: 'Bad Request, "message" not set' };

		return cb();
	}

	message.message = req.jsonBody.message;
	message.metadata = req.jsonBody.metadata || {};
	message.emitType = req.jsonBody.emitType || 'message';
	message.timestamp = new Date();

	req.messageHandler.handleMessage(message)
		.then(() => cb())
		.catch(cb);
}

exports = module.exports = broadcastMessage;
