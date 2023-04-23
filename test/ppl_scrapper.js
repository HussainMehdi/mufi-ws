const registerPingPPL = (ws) => {
    ws.send(JSON.stringify({ command: 'registerPPLScrapper', data: {} }));
    let scrapperUID = null;
    ws.on('message', async (message) => {
        // check if message is a json with command ping
        // if yes, send a pong back
        try {
            const payload = JSON.parse(message.utf8Data);
            const { command, data } = payload;
            if (command === 'ping') {
                ws.send(JSON.stringify({ command: 'pong', data: { scrapperUID } }));
            } else if (command === 'registerPPLScrapper') {
                scrapperUID = data.id;
                console.log(`Registered scrapper with id ${scrapperUID}`);
            }
        }
        catch (e) {
            console.log(e);
            return;
        }
    })
}

const pplScrapeResult = async (ws) => {
    const r = {
        "command": "pplScrapeResult",
        "data": {
            "artistId": 611717,
            "value": {
                "unlinkedTracks": [
                    {
                        "recordingId": "643897440",
                        "bandArtistName": "DUBFIRE",
                        "recordingTitle": "Roadkill",
                        "isrc": "NLF710902266",
                        "pDate": "2009",
                        "pName": "Armada Music B.V.",
                        "recordingDuration": "0:00",
                        "countryOfRecording": "Netherlands",
                        "countryOfCommissioning": "Netherlands",
                        "contentType": "Video",
                        "valid": true,
                        "myRepertoire": "",
                        "reportedUse": false
                    },
                    {
                        "recordingId": "643897440",
                        "bandArtistName": "DUBFIRE",
                        "recordingTitle": "Roadkill",
                        "isrc": "NLF710902266",
                        "pDate": "2009",
                        "pName": "Armada Music B.V.",
                        "recordingDuration": "0:00",
                        "countryOfRecording": "Netherlands",
                        "countryOfCommissioning": "Netherlands",
                        "contentType": "Video",
                        "valid": true,
                        "myRepertoire": "",
                        "reportedUse": false
                    },
                    {
                        "recordingId": "643897440",
                        "bandArtistName": "DUBFIRE",
                        "recordingTitle": "Roadkill",
                        "isrc": "NLF710902266",
                        "pDate": "2009",
                        "pName": "Armada Music B.V.",
                        "recordingDuration": "0:00",
                        "countryOfRecording": "Netherlands",
                        "countryOfCommissioning": "Netherlands",
                        "contentType": "Video",
                        "valid": true,
                        "myRepertoire": "",
                        "reportedUse": false
                    },
                    {
                        "recordingId": "643897440",
                        "bandArtistName": "DUBFIRE",
                        "recordingTitle": "Roadkill",
                        "isrc": "NLF710902266",
                        "pDate": "2009",
                        "pName": "Armada Music B.V.",
                        "recordingDuration": "0:00",
                        "countryOfRecording": "Netherlands",
                        "countryOfCommissioning": "Netherlands",
                        "contentType": "Video",
                        "valid": true,
                        "myRepertoire": "",
                        "reportedUse": false
                    },
                    {
                        "recordingId": "643897440",
                        "bandArtistName": "DUBFIRE",
                        "recordingTitle": "Roadkill",
                        "isrc": "NLF710902266",
                        "pDate": "2009",
                        "pName": "Armada Music B.V.",
                        "recordingDuration": "0:00",
                        "countryOfRecording": "Netherlands",
                        "countryOfCommissioning": "Netherlands",
                        "contentType": "Video",
                        "valid": true,
                        "myRepertoire": "",
                        "reportedUse": false
                    },
                    {
                        "recordingId": "643897440",
                        "bandArtistName": "DUBFIRE",
                        "recordingTitle": "Roadkill",
                        "isrc": "NLF710902266",
                        "pDate": "2009",
                        "pName": "Armada Music B.V.",
                        "recordingDuration": "0:00",
                        "countryOfRecording": "Netherlands",
                        "countryOfCommissioning": "Netherlands",
                        "contentType": "Video",
                        "valid": true,
                        "myRepertoire": "",
                        "reportedUse": false
                    },
                    {
                        "recordingId": "628063596",
                        "bandArtistName": "ALEX METRIC | DJ EASE | DUBFIRE | PAUL OAKENFOLD",
                        "recordingTitle": "Electrospective Interviews: IMS 7 Most Influential Person",
                        "isrc": "GB0401200161",
                        "pDate": "2012",
                        "pName": "EMI Records Ltd",
                        "recordingDuration": "3:30",
                        "countryOfRecording": "United Kingdom",
                        "countryOfCommissioning": "United Kingdom",
                        "contentType": "Video",
                        "valid": true,
                        "myRepertoire": "",
                        "reportedUse": false
                    }
                ],
                "linkedTracksCount": 593
            }
        }
    }
    ws.send(JSON.stringify(r));
}


module.exports = {
    registerPingPPL,
    pplScrapeResult
}