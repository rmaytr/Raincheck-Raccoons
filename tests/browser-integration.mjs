/**
 * Real UI journey using independent browser contexts, no API gameplay shortcuts.
 * PLAYWRIGHT_MODULE may point at an existing installed Playwright package.
 * BASE_URL defaults to local preview. Remote runs require LOW_VOLUME_REMOTE=1.
 * TARGETED_ONLY=1 runs restoration/race/accessibility regression cases.
 * TEST_OUTPUT_DIR overrides test-results/browser for separate evidence runs.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.env.BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname);
assert.ok(local || process.env.LOW_VOLUME_REMOTE === '1', 'Remote UI writes require LOW_VOLUME_REMOTE=1');
const shots = process.env.TEST_OUTPUT_DIR
  ? path.resolve(process.env.TEST_OUTPUT_DIR)
  : fileURLToPath(new URL('../test-results/browser/', import.meta.url));
await mkdir(shots, { recursive: true });
const started = Date.now();
const checks = [];
const errors = [];
const consoleErrors = [];
const networkFailures = [];
const states = new Map();
const report = { base, checks, errors, consoleErrors, networkFailures };
let browser;
let host;
let guest;
function pass(text) { checks.push(text); console.log(`PASS ${text}`); }
function observe(page, label) {
  page.on('pageerror', error => errors.push({ page: label, message: error.message }));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push({ page: label, message: message.text() });
  });
  page.on('requestfailed', request => networkFailures.push({
    page: label, url: request.url(), error: request.failure()?.errorText,
  }));
  page.on('response', async response => {
    if (!response.url().startsWith(`${base}/api/rooms`) || !response.ok()) return;
    const data = await response.json().catch(() => null);
    if (data?.code && data?.phase) {
      const previous = states.get(label);
      if (!previous || previous.code !== data.code || data.version >= previous.version) states.set(label, data);
    }
  });
}
async function until(predicate, label, timeout = 15_000) {
  const stop = Date.now() + timeout;
  while (Date.now() < stop) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out: ${label}`);
}
async function screenshot(page, name) {
  await page.screenshot({ path: path.join(shots, `browser-${name}.png`), fullPage: true, animations: 'disabled' });
}
async function noOverflow(page, label) {
  const widths = await page.evaluate(() => ({
    viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth,
  }));
  assert.ok(widths.document <= widths.viewport + 1 && widths.body <= widths.viewport + 1,
    `${label} overflows horizontally: ${JSON.stringify(widths)}`);
  pass(`${label}: no horizontal overflow`);
}
async function rules(page, label) {
  const help = page.getByRole('button', { name: 'How to play' });
  await help.click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  assert.equal(await page.getByRole('button', { name: 'Close dialog' }).evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.getByRole('button', { name: /Got it/ }).evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('button', { name: 'Close dialog' }).evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await help.evaluate(el => el === document.activeElement), true);
  pass(`${label}: rules dialog traps focus, closes with Escape, and restores focus`);
}

async function targeted(browser) {
  const context = await browser.newContext({
    viewport: { width: 320, height: 800 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  });
  host = await context.newPage();
  host.setDefaultTimeout(15_000);
  observe(host, 'targeted');
  await host.goto(base, { waitUntil: 'domcontentloaded' });
  await host.locator('.entry-card').waitFor();
  await until(() => host.getByRole('button', { name: 'Make a room' }).isEnabled(), 'welcome bootstrap complete');
  await host.locator('#nickname').fill('LongestNicknameXYZ');
  assert.equal((await host.locator('#nickname').inputValue()).length, 18);
  await noOverflow(host, '320px welcome with maximum-length nickname');
  const reduced = await host.evaluate(() => ({
    prefers: matchMedia('(prefers-reduced-motion: reduce)').matches,
    animations: document.getAnimations().filter(a => a.playState === 'running').map(a => a.effect?.getTiming().duration),
  }));
  assert.equal(reduced.prefers, true);
  assert.ok(reduced.animations.every(duration => typeof duration === 'number' && duration <= 1),
    `Long animation still running under reduced motion: ${JSON.stringify(reduced.animations)}`);
  pass('Reduced-motion preference disables sustained decorative animation');
  await host.getByRole('button', { name: 'Enable sound' }).click();
  assert.equal(await host.getByRole('button', { name: 'Mute sound' }).getAttribute('aria-pressed'), 'true');
  await host.reload({ waitUntil: 'domcontentloaded' });
  await host.getByRole('button', { name: 'Mute sound' }).waitFor();
  assert.equal(await host.evaluate(() => localStorage.getItem('raincheck-sound')), 'on');
  await host.getByRole('button', { name: 'Mute sound' }).click();
  assert.equal(await host.evaluate(() => localStorage.getItem('raincheck-sound')), 'off');
  pass('Sound toggle exposes pressed state, persists across reload, and can be muted');

  // Restore the maximum-length name after the first reload, before saving a room.
  await host.locator('#nickname').fill('LongestNicknameXYZ');
  await host.getByRole('button', { name: 'Make a room' }).click();
  await host.getByRole('heading', { name: 'The usual suspects' }).waitFor();
  const code = (await host.locator('.invite-card strong').textContent()).trim();
  const identity = states.get('targeted').meId;
  await noOverflow(host, '320px lobby with maximum-length nickname');
  await screenshot(host, 'targeted-lobby-320');
  const roomURL = `${base}/api/rooms/${code}`;
  let bootstrapIntercepted = false;
  await host.route(roomURL, async route => {
    if (route.request().method() === 'GET' && !bootstrapIntercepted) {
      bootstrapIntercepted = true;
      await route.fulfill({
        status: 503, contentType: 'application/json',
        body: JSON.stringify({ error: 'QA transient service outage', code: 'SERVICE_UNAVAILABLE' }),
      });
    } else await route.continue();
  });
  await host.reload({ waitUntil: 'domcontentloaded' });
  await host.getByRole('button', { name: 'Retry saved room' }).waitFor();
  assert.equal(await host.evaluate(() => localStorage.getItem('raincheck-room')), code);
  await screenshot(host, 'targeted-restore-retry');
  await host.unroute(roomURL);
  await host.getByRole('button', { name: 'Retry saved room' }).click();
  await host.getByRole('heading', { name: 'The usual suspects' }).waitFor();
  assert.equal(states.get('targeted').meId, identity);
  assert.equal(states.get('targeted').players.filter(p => !p.left).length, 1);
  pass('Transient bootstrap failure preserves saved room and Retry restores the same seat');

  let markCaptured;
  const captured = new Promise(resolve => { markCaptured = resolve; });
  let release;
  const released = new Promise(resolve => { release = resolve; });
  await host.route(roomURL, async route => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch();
    markCaptured();
    await released;
    await route.fulfill({ response });
  });
  await captured;
  await host.getByRole('button', { name: 'Leave room', exact: true }).click();
  await host.getByRole('dialog').getByRole('button', { name: 'Leave room', exact: true }).click();
  await host.locator('.entry-card').waitFor();
  const staleResponse = host.waitForResponse(response => response.url() === roomURL);
  release();
  await staleResponse;
  await host.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await host.locator('.entry-card').isVisible(), true);
  assert.equal(await host.locator('.crew-panel').count(), 0);
  assert.equal(await host.evaluate(() => localStorage.getItem('raincheck-room')), '');
  pass('Delayed successful poll after Leave cannot resurrect departed room state');
  await host.unroute(roomURL);
  assert.equal(errors.length, 0);
  pass('Targeted regressions produce no uncaught browser exceptions');
}

try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
  });
  if (process.env.TARGETED_ONLY === '1') {
    await targeted(browser);
  } else {
  const hostContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce',
  });
  host = await hostContext.newPage();
  guest = await guestContext.newPage();
  host.setDefaultTimeout(15_000);
  guest.setDefaultTimeout(15_000);
  observe(host, 'host');
  observe(guest, 'guest');
  await host.goto(base, { waitUntil: 'domcontentloaded' });
  await host.getByRole('button', { name: 'Make a room' }).waitFor();
  await until(() => host.getByRole('button', { name: 'Make a room' }).isEnabled(), 'welcome bootstrap complete');
  await screenshot(host, 'welcome-desktop');
  await rules(host, 'Welcome');
  await host.locator('#nickname').fill('Captain QA');
  await host.getByRole('button', { name: 'Raincoat 3', exact: true }).click();
  assert.equal(await host.getByRole('button', { name: 'Raincoat 3', exact: true }).getAttribute('aria-pressed'), 'true');
  await host.getByRole('button', { name: 'Make a room' }).click();
  const codeLocator = host.locator('.invite-card strong');
  await codeLocator.waitFor();
  const code = (await codeLocator.textContent()).trim();
  assert.match(code, /^[A-Z0-9]{6}$/);
  await guest.goto(`${base}/?room=${code}`, { waitUntil: 'domcontentloaded' });
  assert.equal(await guest.locator('#room-code').inputValue(), code);
  await guest.locator('#nickname').fill('Puddle QA');
  await guest.getByRole('button', { name: 'Raincoat 6', exact: true }).click();
  await screenshot(guest, 'join-mobile');
  await noOverflow(guest, '390px join screen');
  await guest.getByRole('button', { name: 'Join the crew' }).click();
  await until(() => states.get('host')?.players.length === 2 && states.get('guest')?.players.length === 2, 'both rosters');
  const hostId = states.get('host').meId;
  const guestId = states.get('guest').meId;
  assert.notEqual(hostId, guestId);
  assert.equal(states.get('host').players.find(p => p.id === hostId).avatar, 2);
  assert.equal(states.get('guest').players.find(p => p.id === guestId).avatar, 5);
  pass('Real create and invite join preserve names and chosen avatars in independent cookie contexts');
  await noOverflow(guest, '390px lobby');
  await screenshot(guest, 'lobby-mobile');

  await guest.reload({ waitUntil: 'domcontentloaded' });
  await guest.getByRole('heading', { name: 'The usual suspects' }).waitFor();
  assert.equal(states.get('guest').meId, guestId);
  pass('Browser refresh restores the existing seat and lobby');
  await host.getByRole('button', { name: 'Let the night begin' }).click();

  for (let round = 1; round <= 6; round++) {
    await until(() => states.get('host')?.phase === 'planning' && states.get('host')?.round === round
      && states.get('guest')?.phase === 'planning' && states.get('guest')?.round === round, `raid ${round} planning`);
    await host.getByRole('heading', { name: 'Where to, troublemaker?' }).waitFor();
    await guest.getByRole('heading', { name: 'Where to, troublemaker?' }).waitFor();
    if (round === 1) {
      await rules(guest, 'Planning on mobile');
      await noOverflow(guest, '390px planning board');
      await screenshot(host, 'planning-desktop');
      await screenshot(guest, 'planning-mobile');
    }
    await host.locator('.roof-card').filter({ hasText: 'Moonrise Bakery' }).click();
    await host.locator('.role-card').filter({ hasText: 'Lookout' }).click();
    await host.getByRole('button', { name: 'Lock my plan' }).click();
    await host.getByRole('button', { name: 'Locked in' }).waitFor();
    await until(() => states.get('guest')?.submittedIds.includes(hostId), 'guest sees host readiness');
    assert.equal(states.get('guest').myChoice, null);
    assert.equal(states.get('guest').choices, undefined);
    assert.equal(await guest.locator('.roof-card').filter({ hasText: 'Noodle House' }).getAttribute('aria-pressed'), 'true');
    pass(`Raid ${round}: host can lock while guest sees readiness without private choice`);
    if (round === 1) {
      await guestContext.setOffline(true);
      await guest.getByText('Reconnecting to your crew… Your seat is saved.').waitFor();
      assert.equal(await guest.getByRole('button', { name: 'Lock my plan' }).isDisabled(), true);
      await guestContext.setOffline(false);
      await guest.getByText('Reconnecting to your crew… Your seat is saved.').waitFor({ state: 'hidden' });
      assert.equal(states.get('guest').meId, guestId);
      pass('Offline mode shows reconnect state, disables submission, and resumes the same seat');
    }
    await guest.locator('.roof-card').filter({ hasText: 'Moonrise Bakery' }).click();
    await guest.locator('.role-card').filter({ hasText: 'Sneak' }).click();
    await guest.getByRole('button', { name: 'Lock my plan' }).click();
    await host.getByRole('heading', { name: 'So that was the plan.' }).waitFor();
    await guest.getByRole('heading', { name: 'So that was the plan.' }).waitFor();
    const hostState = states.get('host');
    assert.equal(hostState.result.round, round);
    assert.equal(hostState.result.roofs.flatMap(r => r.players).length, 2);
    assert.ok(hostState.players.every(p => p.score >= 0));
    pass(`Raid ${round}: both browsers reveal one authoritative result`);
    if (round === 1) {
      await noOverflow(guest, '390px reveal');
      await screenshot(host, 'reveal-desktop');
      await screenshot(guest, 'reveal-mobile');
    }
    const next = host.getByRole('button', { name: round === 6 ? 'See the winners' : 'Next raid', exact: true });
    await next.click(); // Playwright waits for the real three-second reveal grace.
  }
  await host.getByRole('heading', { name: 'The crumbs have settled.' }).waitFor();
  await guest.getByRole('heading', { name: 'The crumbs have settled.' }).waitFor();
  assert.equal(states.get('host').history.length, 6);
  await guest.getByText('Your night, raid by raid').click();
  assert.equal(await guest.locator('.night-recap p').count(), 6);
  await noOverflow(guest, '390px finale');
  await screenshot(host, 'finale-desktop');
  await screenshot(guest, 'finale-mobile');
  const oldMatch = states.get('host').matchId;
  await host.getByRole('button', { name: 'One more night?' }).click();
  await host.getByRole('heading', { name: 'The usual suspects' }).waitFor();
  await guest.getByRole('heading', { name: 'The usual suspects' }).waitFor();
  assert.notEqual(states.get('host').matchId, oldMatch);
  assert.ok(states.get('host').players.every(p => p.score === 0));
  pass('All six raids finish, recap is complete, and rematch retains crew with zero scores');
  assert.equal(errors.length, 0, `Uncaught browser exceptions: ${JSON.stringify(errors)}`);
  const unexpectedConsole = consoleErrors.filter(e => !/ERR_INTERNET_DISCONNECTED|Failed to fetch/i.test(e.message));
  assert.equal(unexpectedConsole.length, 0, `Unexpected console errors: ${JSON.stringify(unexpectedConsole)}`);
  pass('No uncaught browser exceptions or unexpected console errors');
  }
} catch (error) {
  report.failure = error.stack || String(error);
  console.error(report.failure);
  if (host) await screenshot(host, 'failure-host').catch(() => {});
  if (guest) await screenshot(guest, 'failure-guest').catch(() => {});
  process.exitCode = 1;
} finally {
  report.durationSeconds = +((Date.now() - started) / 1000).toFixed(1);
  await writeFile(path.join(shots, 'browser-report.json'), JSON.stringify(report, null, 2));
  await browser?.close();
  console.log(`${checks.length} browser checks completed in ${report.durationSeconds}s.`);
}
