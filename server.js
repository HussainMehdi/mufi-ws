'use strict';

const express = require('express');
const { Server } = require('ws');
const axios = require('axios');
const { buildCache } = require('./lru_cache');
const { compareMap } = require('./compare_map');

const PORT = process.env.PORT || 9000;
const INDEX = '/index.html';
const DISCOG_API = 'https://dgr4q70dil.execute-api.us-east-1.amazonaws.com/prod/catalog?id='


const discogCache = buildCache();
const pplCache = buildCache();
const comparisionCache = buildCache();

const server = express()
  .use((req, res) => res.sendFile(INDEX, { root: __dirname }))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const wss = new Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.on('close', () => console.log('Client disconnected'));
  ws.on('message', async (message) => {
    try {
      const payload = JSON.parse(message);
      if (payload.key === 'processArtist') {
        const artistId = payload.value;
        if (discogCache.has(artistId)) {
          console.log('discog data already in cache')
        } else {
          // fetch artist data from discogs
          const response = await axios.get(DISCOG_API + artistId)
          const discog = response.data;
          discogCache.set(artistId, discog);
          console.log('discog data fetched successfully')
        }
        if (pplCache.has(artistId)) {
          console.log('ppl data already in cache')
        } else {
          // fetch artist data from ppl
          wss.clients.forEach((client) => {
            client.send(JSON.stringify({
              key: 'pplScrape',
              value: artistId
            }));
          });
        }
      }
      else if (payload.key === 'pplScrapeResult') {
        const artistId = payload.artistId;
        const ppl = payload.value;
        pplCache.set(artistId, ppl);
        console.log('ppl data fetched successfully')
        compareMap(ppl, discogCache.get(artistId)).then((result) => {
          comparisionCache.set(artistId, result);
          ws.send(JSON.stringify({
            key: 'processArtistResult',
            artistId,
            value: result
          }));
        });
      }
      else if (payload.key === 'getArtist') {
        const artistId = payload.value;
        const discog = discogCache.get(artistId);
        const ppl = pplCache.get(artistId);
        ws.send(JSON.stringify({
          key: 'getArtistResult',
          value: {
            discog,
            ppl
          }
        }));
      }
    } catch (e) {
      console.log('Invalid JSON');
      return;
    }
  });
});



// setInterval(() => {
//   wss.clients.forEach((client) => {
//     client.send(new Date().toTimeString());
//   });
// }, 1000);
