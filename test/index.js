const WebSocketClient = require('websocket').client;

const host = 'ws://localhost:9000/';
const client = new WebSocketClient();
const { registerPingPPL, pplScrapeResult } = require('./ppl_scrapper');

client.on('connectFailed', function (error) {
    console.log('Connect Error: ' + error.toString());
});

client.on('connect', function (ws) {
    console.log('Connection established!');

    // registerPingPPL(ws);
    pplScrapeResult(ws);

    ws.on('error', function (error) {
        console.log("Connection error: " + error.toString());
    });

    ws.on('close', function () {
        console.log('Connection closed!');
    });

    ws.on('message', function (message) {
        console.log(`received: ${message.utf8Data}`);
    });
});

client.connect(host);

