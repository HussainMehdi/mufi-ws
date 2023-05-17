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

const buildKey = (artistId, pname) => `${artistId}_${pname}`;

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
    console.log(`Registered ppl scrapper with id ${id}`);
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
      console.log(`Scrapper ${id} ponged`);
    }
    return undefined;
  },
  progress: async (ws, payload) => {
    const { artistId, currentProgress, totalProgressCount, key, pname } = payload;
    const _key = buildKey(artistId, pname);
    if (artistId && currentProgress && totalProgressCount && key) {
      const progress = comparisionCache.get(_key).progress;
      progress[key] = {
        currentProgress,
        totalProgressCount,
      };
      broadcast(buildWsMessage('progress', { artistId: _key, progress }));
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
    const { artistId, pname } = payload;
    if (artistId) {
      const key = buildKey(artistId, pname);
      const artistResult = comparisionFinalResults.get(key);
      if (artistResult) {
        broadcast(buildWsMessage('artistResult', {
          artistId,
          pname,
          result: artistResult
        }));
        return undefined;
      }
      if (comparisionCache.get(key)) {
        if (pplCache.get(key)) {
          wsCommands.pplScrapeResult(ws, { artistId, value: pplCache.get(key) });
        }
        broadcast(buildWsMessage('progress', { artistId, progress: comparisionCache.get(key).progress }));
        return undefined;
      }
      const scrapper = Object.values(pplScrappers).find((scrapper) => scrapper.state === scrapperStates.idle);
      if (scrapper) {
        scrapper.state = scrapperStates.onjob;
        comparisionCache.set(key, {
          artistId,
          progress: {
          },
        });
        scrapper.ws.send(JSON.stringify({ command: 'pplScrape', data: { artistId, pname } }));
      } else {
        console.log('No scrapper available');
        ws.send(buildWsMessage('error', { message: 'all services busy' }));
      }
    }
    return undefined;
  },
  pplScrapeResult: async (ws, payload) => {
    const { artistId, pname, value } = payload;
    if (artistId && value) {
      const key = buildKey(artistId, pname);
      pplCache.set(key, value);
      const artistResult = {
        processedInfo: value,
      };
      comparisionFinalResults.set(key, artistResult);
      broadcast(buildWsMessage('artistResult', {
        artistId,
        pname,
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