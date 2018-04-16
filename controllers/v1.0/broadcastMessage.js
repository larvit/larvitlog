'use strict';

const	topLogPrefix	= require('winston').appLogPrefix + __filename + ' - ',
	handler	= require(__dirname + '/../../models/messageHandler.js'),
	log	= require('winston');

function broadcastMessage(req, res, cb) {
	const	logPrefix	= topLogPrefix	+ 'broadcastMessage() - ',
		message	= {};

	log.debug(logPrefix + 'rawBody: ' + req.rawBody);

	if (req.method.toUpperCase() !== 'POST') {
		log.verbose(topLogPrefix + 'Got request with unallowed method: "' + req.method + '", query: "' + req.urlParsed.href + '"');
		res.statusCode	= 405;
		res.data	= '405 Method Not Allowed\nAllowed methods: POST';
		return cb();
	}

	res.statusCode	= 200;
	res.data	= { 'message': 'OK' };

	if ( ! req.jsonBody) {
		res.statusCode	= 400;
		res.data	= {'message': 'Bad Request, no body' };
		return cb();
	}

	if ( ! req.jsonBody.message || req.jsonBody.message === '') {
		res.statusCode	= 400;
		res.data	= {'message': 'Bad Request, "message" not set' };
		return cb();
	}

	message.message	= req.jsonBody.message;
	message.metadata	= req.jsonBody.metadata || {};
	message.emitType	= req.jsonBody.emitType || 'message';
	message.timestamp	= new Date();

	handler.handleMessage(message, cb);
}

exports = module.exports = broadcastMessage;
