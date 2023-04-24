'use strict';

const express = require('express');
const { Server } = require('ws');
const axios = require('axios');
const uuid = require('uuid').v4;
const https = require('https');
const fs = require('fs');
const { buildCache } = require('./lru_cache');
const { compareMap } = require('./compare_map');

const PORT = process.env.PORT || 9000;
const SCRAPPER_ACTIVE_TIMEOUT = 10000;
const INDEX = '/index.html';
const DISCOG_API = 'https://dgr4q70dil.execute-api.us-east-1.amazonaws.com/prod/catalog?id='


const key = fs.readFileSync('key.pem');
const cert = fs.readFileSync('cert.pem');


// all registered ppl scrappers
// ppl scrapper will send `registerPPLScrapper` command to register itself
// ws will register ppl scrapper with unique uuid
// ws will send a message scrape ppl data, when required
// ppl scrapper will send `pplScrapped` command to ws with ppl data
// ppl scrapper will send `progress` command to ws with scraping progress with {artistId, currentProgress, totalProgressCount, key}
const pplScrappers = {};

const discogCache = buildCache();
const pplCache = buildCache();
const comparisionCache = buildCache();
const comparisionFinalResults = buildCache();

const _express = express()
  .use((req, res) => res.sendFile(INDEX, { root: __dirname }))

const server = https.createServer({ key, cert }, _express);

const scrapperStates = {
  idle: 'idle',
  onjob: 'onjob',
  scraping: 'scraping',
  done: 'done',
  offline: 'offline',
  error: 'error',
}

const buildWsMessage = (command, data) => {
  return JSON.stringify({ command, data });
}

const wsCommands = {
  registerPPLScrapper: async (ws, payload) => {
    const id = uuid();
    pplScrappers[id] = {
      id,
      ws,
      state: scrapperStates.idle,
      lastPong: Date.now(),
    };
    return buildWsMessage('registerPPLScrapper', { id });
  },
  healthCheck: async (ws, payload) => {
    return { status: 'ok' };
  },
  pingPPLScrappers: async (ws, payload) => {
    Object.keys(pplScrappers).forEach((scrapper) => {
      pplScrappers[scrapper].ws.send(JSON.stringify({ command: 'ping', data: {} }));
    });
    return { status: 'ok' };
  },
  pong: async (ws, payload) => {
    const { id } = payload;
    if (id && pplScrappers[id]) {
      pplScrappers[id].lastPong = Date.now();
    }
    return undefined;
  },
  progress: async (ws, payload) => {
    const { artistId, currentProgress, totalProgressCount, key } = payload;
    if (artistId && currentProgress && totalProgressCount && key) {
      const progress = comparisionCache.get(artistId).progress;
      progress[key] = {
        currentProgress,
        totalProgressCount,
      };
      broadcast(buildWsMessage('progress', { artistId, progress }));
    }
    return undefined;
  },
  pplScrapeState: async (ws, payload) => {
    const { meta } = payload;
    if (meta) {
      pplScrappers[meta.uid].state = meta.state;
    }
  },
  processArtist: async (ws, payload) => {
    const { artistId } = payload;
    if (artistId) {
      const artistResult = comparisionFinalResults.get(artistId);
      if (artistResult) {
        broadcast(buildWsMessage('artistResult', {
          artistId,
          result: artistResult
        }));
        return undefined;
      }
      if (comparisionCache.get(artistId)) {
        if (pplCache.get(artistId)) {
          wsCommands.pplScrapperResult(ws, { artistId, value: pplCache.get(artistId) });
        }
        broadcast(buildWsMessage('progress', { artistId, progress: comparisionCache.get(artistId).progress }));
        return undefined;
      }
      const scrapper = Object.values(pplScrappers).find((scrapper) => scrapper.state === scrapperStates.idle);
      if (scrapper) {
        scrapper.state = scrapperStates.onjob;
        comparisionCache.set(artistId, {
          artistId,
          progress: {
          },
        });

        // process discog data
        const discogData = discogCache.get(artistId);
        if (!discogData) {
          // discog api is paginated now
          // with `x-total-record-count` in header to calculate progress
          // https://discog-api.com?id=673106&page=2&per_page=200

          // get all discog records with pagination and calculate progress
          const discogData = [];
          let page = 1;
          let totalRecords = 0;
          let currentRecords = 0;
          let _data = [];
          do {
            const { data, headers } = await axios.get(`${DISCOG_API}${artistId}&page=${page}&per_page=200`);
            _data = data;

            if (data && data.length) {
              discogData.push(...data);
              currentRecords += data.length;
              if (headers['x-total-record-count']) {
                totalRecords = parseInt(headers['x-total-record-count']);
              }
              const progress = comparisionCache.get(artistId).progress;
              progress['swarm'] = {
                currentProgress: currentRecords,
                totalProgressCount: totalRecords,
              };
              broadcast(buildWsMessage('progress', { artistId, progress }));
            }
            page += 1;
          } while (_data && _data.length);
          discogCache.set(artistId, discogData);

        }
        scrapper.ws.send(JSON.stringify({ command: 'pplScrape', data: { artistId } }));
      } else {
        console.log('No scrapper available');
        ws.send(buildWsMessage('error', { message: 'all services busy' }));
      }
    }
    return undefined;
  },
  pplScrapeResult: async (ws, payload) => {
    const { artistId, value } = payload;
    if (artistId && value) {
      const discogData = discogCache.get(artistId);
      pplCache.set(artistId, value);
      const comparisonResult = await compareMap(value.unlinkedTracks, discogData, (mappingProgress) => {
        const progress = comparisionCache.get(artistId).progress;
        progress.mapping = mappingProgress;
        broadcast(buildWsMessage('progress', { artistId, progress }));
      });
      const artistResult = {
        processedInfo: value,
        comparisonResult
      };
      comparisionFinalResults.set(artistId, artistResult);
      broadcast(buildWsMessage('artistResult', {
        artistId,
        result: artistResult
      }));
    }
    return undefined;
  }
}

const wss = new Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.on('close', () => console.log('Client disconnected'));
  ws.on('message', async (message) => {
    try {
      const payload = JSON.parse(message);
      const { command, data } = payload;
      const commandHandler = wsCommands[command];
      if (commandHandler) {
        const resp = await commandHandler(ws, data);
        if (resp)
          ws.send(resp);
      } else {
        console.log('unknown command', command);
        ws.send(buildWsMessage('error', { message: 'unknown command', payload }));
      }
    } catch (e) {
      ws.send(buildWsMessage('error', { message: 'unknown message', e }));
      console.log(e);
      return;
    }
  });
});

const scrapperHealthCheck = setInterval(() => {
  wsCommands.pingPPLScrappers();

  Object.keys(pplScrappers).forEach((scrapper) => {
    const scrapperState = pplScrappers[scrapper];
    if (Date.now() - scrapperState.lastPong > SCRAPPER_ACTIVE_TIMEOUT) {
      console.log(`Scrapper ${scrapper} is offline, removing it from scrappers list`);
      delete pplScrappers[scrapper];
    }
  });
}, 2000);

const broadcast = (message) => {
  wss.clients.forEach((client) => {
    client.send(message);
  });
};
// clear health check interval on exit
process.on('SIGINT', () => {
  clearInterval(scrapperHealthCheck);
  process.exit();
});

server.listen(PORT, () => console.log(`Listening on ${PORT}`));