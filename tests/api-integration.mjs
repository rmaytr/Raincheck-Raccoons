/**
 * Independent HTTP integration checks. No packages or browser globals required.
 * Run against a LOCAL running preview:
 *   node tests/api-integration.mjs
 *   BASE_URL=http://127.0.0.1:4173 node tests/api-integration.mjs
 *   EXTENDED_ONLY=1 node tests/api-integration.mjs  (real timeout/bot/host-absence checks)
 * Use ALLOW_REMOTE_TESTS=1 only after explicitly authorizing a disposable remote room.
 */
import assert from 'node:assert/strict';

const base = (process.env.BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname);
if (!local && process.env.ALLOW_REMOTE_TESTS !== '1') {
  throw new Error('Refusing remote writes. Set ALLOW_REMOTE_TESTS=1 only for an authorized deployment.');
}

const successes = [];
const started = Date.now();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const publicKeys = new Set([
  'code', 'version', 'phase', 'round', 'totalRounds', 'hostId', 'meId', 'players',
  'deadline', 'serverTime', 'phaseStartedAt', 'roofs', 'weather', 'submittedIds',
  'myChoice', 'result', 'history', 'practice', 'reactions', 'matchId',
]);

class Client {
  constructor(name, cookie = '') {
    this.name = name;
    this.cookie = cookie;
    this.cookieHeaders = [];
  }
  async request(path, body, options = {}) {
    const response = await fetch(`${base}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json', origin: base }),
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...(options.headers || {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20_000),
    });
    const setCookies = response.headers.getSetCookie?.() ||
      (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')] : []);
    if (setCookies.length) {
      this.cookieHeaders.push(...setCookies);
      const cookies = new Map(this.cookie.split('; ').filter(Boolean).map(c => {
        const i = c.indexOf('=');
        return [c.slice(0, i), c.slice(i + 1)];
      }));
      for (const header of setCookies) {
        const [pair] = header.split(';');
        const i = pair.indexOf('=');
        cookies.set(pair.slice(0, i), pair.slice(i + 1));
      }
      this.cookie = [...cookies].map(([key, value]) => `${key}=${value}`).join('; ');
    }
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch {
      // Vinext can reject cross-origin requests before our JSON route handler.
      if (response.status === 403 && text.trim() === 'Forbidden') {
        data = { error: 'Forbidden', code: 'FRAMEWORK_FORBIDDEN' };
      } else {
        throw new Error(`${this.name} ${path}: non-JSON HTTP ${response.status}: ${text.slice(0, 160)}`);
      }
    }
    return { status: response.status, data, headers: response.headers };
  }
  async ok(path, body) {
    const res = await this.request(path, body);
    assert.ok(res.status === 200 || res.status === 201,
      `${this.name} ${path}: expected 200/201, received ${res.status}: ${JSON.stringify(res.data)}`);
    return res.data;
  }
  action(code, action) { return this.ok(`/api/rooms/${code}/actions`, action); }
  get(code) { return this.ok(`/api/rooms/${code}`); }
}

function passed(label) {
  successes.push(label);
  console.log(`PASS ${label}`);
}

function assertPrivate(view) {
  for (const key of Object.keys(view)) {
    assert.ok(publicKeys.has(key), `Unexpected room key '${key}': review for private state exposure`);
  }
  for (const player of view.players) {
    for (const key of Object.keys(player)) {
      assert.ok(!/choice|session|token|secret|hash/i.test(key), `Private player field '${key}' leaked`);
    }
  }
  assert.ok(view.submittedIds.every(id => view.players.some(player => player.id === id)),
    'Submitted IDs contain values other than public player IDs');
  if (view.phase === 'planning') assert.equal(view.result, null, 'Current round results leaked before reveal');
}

async function denied(client, path, body, label, options = {}) {
  const result = await client.request(path, body, options);
  assert.ok(result.status >= 400 && result.status < 500,
    `${label}: expected 4xx, got ${result.status}: ${JSON.stringify(result.data)}`);
  assert.equal(typeof result.data.error, 'string', `${label}: missing useful error`);
  passed(label);
  return result.data;
}

async function waitFor(client, code, predicate, description, timeout = 20_000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const state = await client.get(code);
    if (predicate(state)) return state;
    await sleep(250);
  }
  throw new Error(`Timed out: ${description}`);
}

async function advance(host, code, oldRound) {
  const until = Date.now() + 18_000;
  while (Date.now() < until) {
    const view = await host.get(code);
    if (view.phase === 'finished' || (view.phase === 'planning' && view.round > oldRound)) return view;
    assert.equal(view.phase, 'reveal', `Expected reveal before advance, got ${view.phase}`);
    const response = await host.request(`/api/rooms/${code}/actions`, { type: 'advance' });
    if (response.status === 200) return response.data;
    assert.ok(response.status >= 400 && response.status < 500,
      `Advance failed unexpectedly: ${JSON.stringify(response.data)}`);
    await sleep(400);
  }
  throw new Error('Host could not advance after reveal grace period');
}

async function run() {
  const host = new Client('host');
  let view = await host.ok('/api/rooms', { name: 'QA Host', avatar: 0, practice: false });
  const code = view.code;
  assert.match(code, /^[A-Z0-9]{4,8}$/);
  assert.equal(view.phase, 'lobby');
  assert.equal(view.players.length, 1);
  assert.equal(view.meId, view.hostId);
  assert.ok(host.cookie, 'Create did not establish a session');
  assert.ok(host.cookieHeaders.some(cookie => /httponly/i.test(cookie)), 'Session cookie must be HttpOnly');
  assert.ok(host.cookieHeaders.some(cookie => /samesite=(lax|strict)/i.test(cookie)), 'Missing SameSite cookie');
  assertPrivate(view);
  passed('Create establishes private host identity and bounded public lobby');

  const guest = new Client('guest');
  const guestView = await guest.ok(`/api/rooms/${code}/join`, { name: 'QA Guest', avatar: 1 });
  assert.equal(guestView.players.length, 2);
  assert.notEqual(guestView.meId, view.meId);
  passed('Join creates an independent player identity');

  const reload = new Client('refresh', guest.cookie);
  assert.equal((await reload.get(code)).meId, guestView.meId);
  assert.equal((await reload.ok(`/api/rooms/${code}/join`, { name: 'QA Guest', avatar: 1 })).players.length, 2);
  passed('Refresh and repeated join retain identity without duplicating a player');
  const refreshedResponse = await reload.request(`/api/rooms/${code}`);
  assert.match(refreshedResponse.headers.get('cache-control') || '', /no-store/);
  assert.match(refreshedResponse.headers.get('vary') || '', /cookie/i);
  passed('Player-specific responses cannot be cached across identities');

  const duplicate = new Client('duplicate');
  await denied(duplicate, `/api/rooms/${code}/join`, { name: 'qa guest', avatar: 1 },
    'Case-insensitive duplicate nickname rejected');

  const anonymous = new Client('anonymous');
  await denied(anonymous, `/api/rooms/${code}`, undefined, 'Anonymous reader cannot inspect room');
  await denied(guest, `/api/rooms/${code}/actions`, { type: 'start' }, 'Non-host cannot start');
  await denied(guest, `/api/rooms/${code}/actions`, { type: 'add-bot' }, 'Non-host cannot add bots');
  await denied(guest, `/api/rooms/${code}/actions`, { type: 'remove-player', targetId: view.hostId },
    'Non-host cannot remove another player');
  await denied(host, `/api/rooms/${code}/actions`, { type: 'start' },
    'Cross-origin state change is rejected', { headers: { origin: 'https://untrusted.invalid' } });

  view = await host.action(code, { type: 'start' });
  const initialMatchId = view.matchId;
  assert.equal(typeof initialMatchId, 'string');
  assert.equal(view.phase, 'planning');
  assert.equal(view.round, 1);
  const late = new Client('late');
  await denied(late, `/api/rooms/${code}/join`, { name: 'Late Friend', avatar: 2 }, 'Mid-match new join rejected');

  for (let round = 1; round <= view.totalRounds; round++) {
    assert.equal(view.phase, 'planning');
    assert.equal(view.round, round);
    const roofId = view.roofs[0].id;
    await denied(host, `/api/rooms/${code}/actions`,
      { type: 'choose', matchId: view.matchId, round, roofId: 'invented-roof', role: 'sneak' },
      `Round ${round}: invalid destination rejected`);
    await host.action(code, { type: 'choose', matchId: view.matchId, round, roofId, role: 'sneak' });
    const sameChoice = await host.action(code, { type: 'choose', matchId: view.matchId, round, roofId, role: 'sneak' });
    assert.deepEqual(sameChoice.myChoice, { roofId, role: 'sneak' });
    const hidden = await guest.get(code);
    assertPrivate(hidden);
    assert.equal(hidden.myChoice, null);
    assert.ok(hidden.submittedIds.includes(view.hostId));
    passed(`Round ${round}: readiness visible while opponent choice remains private`);

    await guest.action(code, { type: 'choose', matchId: view.matchId, round, roofId, role: 'scoop' });
    view = await waitFor(host, code, v => v.phase === 'reveal' || v.phase === 'finished',
      `round ${round} resolution`);
    assert.equal(view.result?.round, round);
    const allResults = view.result.roofs.flatMap(roof => roof.players);
    assert.equal(allResults.length, 2);
    assert.equal(new Set(allResults.map(player => player.id)).size, 2);
    for (const roof of view.result.roofs) {
      const sum = roof.players.reduce((total, p) => total + p.earned, 0);
      assert.ok(sum <= roof.loot, `Round ${round}: created snacks outside stash`);
      if (roof.busted) assert.equal(sum, 0);
    }
    for (const player of view.players) {
      const sum = view.history.flatMap(h => h.roofs)
        .flatMap(roof => roof.players).filter(p => p.id === player.id)
        .reduce((total, p) => total + p.earned, 0);
      assert.equal(player.score, sum, `Round ${round}: scoreboard disagrees with history`);
    }
    passed(`Round ${round}: exactly one result per player and conserved scoring`);
    if (view.phase !== 'finished') {
      await denied(guest, `/api/rooms/${code}/actions`, { type: 'advance' },
        `Round ${round}: non-host cannot advance`);
      view = await advance(host, code, round);
    }
    if (view.phase === 'planning') {
      await denied(host, `/api/rooms/${code}/actions`,
        { type: 'choose', matchId: view.matchId, round, roofId, role: 'scoop' }, `Round ${round}: stale submission rejected`);
      assert.equal((await host.get(code)).myChoice, null, 'Stale choice changed the next round');
    }
  }
  assert.equal(view.phase, 'finished');
  assert.equal(view.history.length, view.totalRounds);
  await denied(guest, `/api/rooms/${code}/actions`, { type: 'rematch' }, 'Non-host cannot rematch');
  view = await host.action(code, { type: 'rematch' });
  assert.equal(view.phase, 'lobby');
  assert.equal(view.players.length, 2);
  assert.ok(view.players.every(p => p.score === 0));
  assert.equal(view.history.length, 0);
  assert.equal(view.result, null);
  assert.notEqual(view.matchId, initialMatchId);
  passed('Six-round match finishes and host rematch resets scoring with same roster');
  const oldMatchError = await denied(host, `/api/rooms/${code}/actions`,
    { type: 'choose', matchId: initialMatchId, round: 1, roofId: view.roofs[0].id, role: 'sneak' },
    'Old match generation cannot submit into rematch');
  assert.equal(oldMatchError.code, 'STALE_MATCH');
  await host.action(code, { type: 'leave' });
  const transferred = await guest.get(code);
  assert.equal(transferred.hostId, guestView.meId);
  await guest.action(code, { type: 'add-bot' });
  await denied(host, `/api/rooms/${code}`, undefined, 'Departed host cannot read the room');
  passed('Explicit host leave transfers control to remaining human');

  const crowdHost = new Client('crowd host');
  const crowd = await crowdHost.ok('/api/rooms', { name: 'Crowd Host', avatar: 0, practice: false });
  const friends = Array.from({ length: 9 }, (_, i) => new Client(`crowd ${i + 1}`));
  await Promise.all(friends.map((client, i) =>
    client.ok(`/api/rooms/${crowd.code}/join`, { name: `Friend ${i + 1}`, avatar: i % 6 })));
  const full = await crowdHost.get(crowd.code);
  assert.equal(full.players.length, 10);
  assert.equal(new Set(full.players.map(p => p.id)).size, 10);
  passed('Nine concurrent joins preserve all ten unique players');
  const extra = new Client('eleventh');
  await denied(extra, `/api/rooms/${crowd.code}/join`, { name: 'Extra', avatar: 0 },
    'Eleventh human cannot exceed room cap');
  await denied(crowdHost, `/api/rooms/${crowd.code}/actions`, { type: 'add-bot' },
    'Host cannot exceed room cap with bot');
  const planning = await crowdHost.action(crowd.code, { type: 'start' });
  await Promise.all([crowdHost, ...friends].map((client, i) =>
    client.action(crowd.code, {
      type: 'choose', matchId: planning.matchId, round: planning.round, roofId: planning.roofs[i % planning.roofs.length].id,
      role: ['sneak', 'scoop', 'lookout'][i % 3],
    })));
  const revealed = await waitFor(crowdHost, crowd.code, v => v.phase === 'reveal', 'ten-player reveal');
  assert.equal(revealed.history.length, 1);
  const outcomes = revealed.result.roofs.flatMap(r => r.players);
  assert.equal(outcomes.length, 10);
  assert.equal(new Set(outcomes.map(p => p.id)).size, 10);
  passed('Ten concurrent choices resolve once without lost or duplicated players');

  console.log(`\n${successes.length} checks passed in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
}

async function runExtended() {
  const absent = new Client('absent host');
  const guest = new Client('present guest');
  const created = await absent.ok('/api/rooms', { name: 'Away Host', avatar: 0, practice: false });
  const joined = await guest.ok(`/api/rooms/${created.code}/join`, { name: 'Here Guest', avatar: 1 });
  await absent.action(created.code, { type: 'start' });

  const practice = new Client('practice human');
  const demo = await practice.ok('/api/rooms', { name: 'Practice QA', avatar: 2, practice: true });
  assert.equal(demo.phase, 'planning');
  assert.equal(demo.players.filter(p => p.bot).length, 3);
  assert.equal(demo.players.filter(p => !p.bot).length, 1);
  await practice.action(demo.code, {
    type: 'choose', matchId: demo.matchId, round: demo.round, roofId: demo.roofs[0].id, role: 'sneak',
  });
  let practicePassed = false;
  let timeoutPassed = false;
  let migrationPassed = false;
  const until = Date.now() + 65_000;
  while (Date.now() < until) {
    if (!practicePassed) {
      const result = await practice.get(demo.code);
      if (result.phase === 'reveal') {
        assert.equal(result.result.roofs.flatMap(roof => roof.players).length, 4);
        assert.ok(result.result.roofs.flatMap(roof => roof.players).every(player => !player.autoPicked));
        practicePassed = true;
        passed('Practice uses three labeled bots that autonomously resolve a raid');
      }
    }
    const state = await guest.get(created.code);
    if (!timeoutPassed && state.history.length) {
      const payouts = state.history[0].roofs.flatMap(roof => roof.players);
      assert.equal(payouts.length, 2);
      assert.ok(payouts.every(p => p.autoPicked === true && p.role === 'sneak'));
      timeoutPassed = true;
      passed('Real deadline auto-picks and discloses conservative choices for missing submissions');
    }
    if (state.hostId === joined.meId) {
      migrationPassed = true;
      passed('Connected guest inherits host authority after original host remains absent');
      break;
    }
    await sleep(800);
  }
  assert.ok(practicePassed && timeoutPassed && migrationPassed,
    `Extended coverage incomplete: practice=${practicePassed}, timeout=${timeoutPassed}, migration=${migrationPassed}`);
  console.log(`\n${successes.length} extended checks passed in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
}

(process.env.EXTENDED_ONLY === '1' ? runExtended() : run()).catch(error => {
  console.error(`\nFAIL after ${successes.length} successful checks:`, error.stack || error);
  process.exitCode = 1;
});
