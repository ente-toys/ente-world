// The sled room on the split world: its socket reaches Iceland's simulation, and a racing duck hides and comes back
// through the delta snapshots other clients receive.
import assert from 'node:assert/strict';
import test from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {build} from 'esbuild';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';

const source = `
import {WorldService} from './worker/world-service.js';
import {IslandSimulation, SeaSimulation} from './worker/simulation.js';
import {WorldPresence} from './worker/world-presence.js';
import {worldStub,simulationStub,internalPost} from './server/simulation-routing.js';
import {connect,connectSled} from './server/pages-auth.js';
import {SLED,SLED_ISLAND} from './src/features/sled-race/rules.js';
import {SLED_HILL} from './src/features/sled-race/hill.js';
export {WorldPresence};
export class TestWorld extends WorldService {
  async fetch(request) {
    if (new URL(request.url).pathname === '/fixture/place') {
      const {account} = await request.json();
      this.sql.exec('INSERT INTO simulation_owners VALUES(?,?,?)', account, SLED_ISLAND, 123);
      this.sql.exec('INSERT INTO simulation_spawn_generations VALUES(?,?)', account, 123);
      return Response.json({});
    }
    return super.fetch(request);
  }
}
export class TestIsland extends IslandSimulation {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/fixture/stall') {
      for (const info of this.room.connections.values()) if (info.actor) Object.assign(info.actor, {x: SLED_HILL.entry[0], y: SLED_HILL.entry[1] + 40, path: []});
      return Response.json({});
    }
    if (path === '/fixture/race') {
      const sled = this.room.sled, at = Date.now() / 1000 + SLED.waitSeconds + 1;
      sled.lobby.tick(Date.now() / 1000);
      sled.lobby.tick(at);
      if (sled.lobby.tick(at + SLED.botCountdown + 1).started) sled.board();
      sled.broadcast();
      return Response.json({phase: sled.lobby.phase});
    }
    if (path === '/fixture/finish') {
      const sled = this.room.sled;
      let happened = {};
      for (let later = 30; !happened.finished && later < 1200; later += 30) happened = sled.lobby.tick(Date.now() / 1000 + later);
      sled.finish(happened.finished); sled.land(happened.finished.standings); sled.broadcast();
      return Response.json({phase: sled.lobby.phase});
    }
    return super.fetch(request);
  }
}
export class TestSea extends SeaSimulation {}
export default {async fetch(request, env) {
  const url = new URL(request.url), world = 'qa';
  env = {...env, ISLAND_ROOM_NAME: world};
  const ctx = {env, request, data: {}};
  if (url.pathname === '/session') {
    const token = crypto.randomUUID().replaceAll('-', '') + '0123456789A', account = 'test-' + crypto.randomUUID();
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))));
    await internalPost(worldStub(env, world), '/session/new', {digest: btoa(String.fromCharCode(...digest)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''),
      account, login: 'fixture', canPlay: true, githubToken: 'fixture'});
    return Response.json({token, account});
  }
  if (url.pathname === '/migrate') return internalPost(worldStub(env, world), '/simulation/migrate', {id: 'one', target: 'split', world});
  if (url.pathname === '/place') return internalPost(worldStub(env, world), '/fixture/place', await request.json());
  if (url.pathname === '/room') return connect(ctx, async () => new Response(null, {status: 204}));
  if (url.pathname === '/sled-room') return connectSled(ctx);
  if (url.pathname.startsWith('/island/')) return simulationStub(env, world, SLED_ISLAND).fetch('https://island.internal/fixture/' + url.pathname.slice(8));
  return new Response(null, {status: 404});
}};`;

test('the sled room runs on Iceland in the split world, and a racer hides and returns through deltas', {timeout: 60000}, async t => {
  const bundle = await build({stdin: {contents: source, resolveDir: process.cwd()}, bundle: true, format: 'esm', write: false});
  const runtime = new Miniflare(convertV4MiniflareOptions({
    modules: [{type: 'ESModule', path: 'index.js', contents: bundle.outputFiles[0].text}], compatibilityDate: '2026-11-02',
    durableObjects: Object.fromEntries(Object.entries({ISLAND: 'TestWorld', ISLAND_SIM: 'TestIsland', SEA_SIM: 'TestSea', WORLD_PRESENCE: 'WorldPresence'})
      .map(([key, className]) => [key, {className, useSQLite: true}])),
  }));
  t.after(() => runtime.dispose());
  const request = (path, opts) => runtime.dispatchFetch('https://game.test' + path, opts);
  const until = async (check, what) => {for (let i = 0; i < 2000; i++) {const value = check(); if (value) return value; await delay(10);} assert.fail('Timed out: ' + what);};
  const open = async (path, token) => {
    const response = await request(path, {headers: {Upgrade: 'websocket', Origin: 'https://game.test', Cookie: '__Host-ducky_session=' + token}});
    assert.equal(response.status, 101, response.status === 101 ? '' : await response.text());
    const socket = response.webSocket, messages = [];
    socket.addEventListener('message', ({data}) => messages.push(JSON.parse(data)));
    socket.accept();
    return {socket, messages};
  };
  const racer = await (await request('/session', {method: 'POST'})).json(), watcher = await (await request('/session', {method: 'POST'})).json();
  assert.equal((await request('/migrate')).status, 200);
  for (const {account} of [racer, watcher]) await request('/place', {method: 'POST', body: JSON.stringify({account})});
  const racing = await open('/room?protocol=2&play=1', racer.token), watching = await open('/room?protocol=2&play=1', watcher.token);
  const racerId = (await until(() => racing.messages.find(m => m.type === 'welcome'), 'welcome')).id;
  await until(() => watching.messages.find(m => m.type === 'snapshot'), 'snapshot');
  watching.socket.send(JSON.stringify({type: 'updates'}));
  await request('/island/stall');
  const sled = await open('/sled-room?protocol=2', racer.token);
  await until(() => sled.messages.find(m => m.type === 'sled-welcome'), 'sled welcome');
  sled.socket.send(JSON.stringify({type: 'sled-join'})); sled.socket.send(JSON.stringify({type: 'sled-ready'}));
  await until(() => sled.messages.some(m => m.type === 'sled-state' && m.seats?.[0]?.ready), 'seat ready');

  // what a client keeps from snapshots and deltas
  let deltas = 0;
  const seen = new Map(), read = () => {
    for (const m of watching.messages.splice(0)) {
      if (m.type !== 'snapshot' && m.type !== 'delta') continue;
      if (m.type === 'snapshot') {seen.clear(); for (const p of m.players) seen.set(p.id, p);}
      else {deltas++; for (const p of m.players.changed) seen.set(p.id, {...seen.get(p.id), ...p});}
      watching.socket.send(JSON.stringify({type: 'snapshot-ack', epoch: m.epoch, tick: m.tick}));
    }
    return seen.get(racerId);
  };
  await request('/island/race');
  await until(() => read()?.sledding === true, 'racer hidden while racing');
  await request('/island/finish');
  const back = await until(() => {const p = read(); return p && !p.sledding ? p : null;}, 'racer back on the island');
  assert.ok(deltas > 0, 'the watcher was on delta updates');
  assert.equal(back.sledding, null);
  for (const s of [sled, racing, watching]) s.socket.close();
});
