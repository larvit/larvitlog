# larvitlog
A small json rest api and websocket server with the main purpose of distributing messages to websocket listerners.

## Installation

```bash
npm i larvitlog;
```

## Usage

### As part of another program
In your start script file, run this:

```javascript
const Logger = require('larvitlog');

const logger = new Logger({
	port: 80,
	fileStoragePath: '/tmp/files',
	intercom, // Instance of larvitamintercom that is used for broadcasting of log messages
	log // Logging object. Will default to a simple console logger if not provided
});

await logger.start();
console.log('Is up and running');
```

## Logging stuff
To send a message that will be broadcast to listening clients post json in the following format to [http://address:port/broadcastMessage]()

```javascript
{
	"message": "this is the message", // the only mandatory field,
	"emitType": "message", // optional, if only want to broadcast to certain listeners. Will default to "message" if left out
	"metadata": {} // a json object containing what ever. Will be broadcast to clienents.
}
```

## Reading the backlog
It is possible to request allready logged messages from the server. Send a GET request to [http://address:port/getMessages]() and an array of message objects like the example above will be returned.

URL query parameters limit and level can be specified to filter messages, for instance [http://address:port/getMessages?limit=100&level=error&level=warn]()

## Road map
Upcomming features

* Get messages by date
* Broadcast messages via rabbit mq