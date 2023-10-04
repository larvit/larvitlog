'use strict';

const topLogPrefix = __filename + ' - ';

function getMessages(req, res, cb) {
	const log = req.log;
	const logPrefix = topLogPrefix + 'getMessages() - ';

	res.setHeader('Access-Control-Allow-Origin', '*');

	log.debug(logPrefix + 'rawBody: ' + req.rawBody);

	if (req.method.toUpperCase() !== 'GET') {
		log.verbose(topLogPrefix + 'Got request with unallowed method: "' + req.method + '", query: "' + req.urlParsed.href + '"');
		res.statusCode = 405;
		res.data = {message: '405 Method Not Allowed\nAllowed methods: GET'};

		return cb();
	}

	const limit = req.urlParsed.query.limit;

	let levels;
	if (req.urlParsed.query.level) {
		levels = Array.isArray(req.urlParsed.query.level) ? req.urlParsed.query.level : [req.urlParsed.query.level];
	}

	req.messageHandler.getData({limit, levels})
		.then(result => {
			res.data = result;
			cb();
		})
		.catch(cb);
}

exports = module.exports = getMessages;
