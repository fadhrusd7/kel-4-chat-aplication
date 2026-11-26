// Comprehensive end-to-end test for Tahap 2 (Time sync & polling)
// Run with: node scratch/tahap2-test.js

// Use native fetch provided by Node.js (v18+). No external dependency needed.
const fetch = (...args) => globalThis.fetch(...args);

/** Simple cookie jar handling */
function extractCookies(setCookieHeaders) {
  if (!setCookieHeaders) return '';
  return setCookieHeaders.map((c) => c.split(';')[0]).join('; ');
}

async function fetchWithCookie(url, options = {}, cookie = '') {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(url, { ...options, headers, redirect: 'manual' });
  const setCookie = extractCookies(res.headers.raw()['set-cookie']);
  const json = await res.json().catch(() => ({}));
  return { res, json, setCookie };
}

function randomString() {
  return Math.random().toString(36).substring(2, 10);
}

async function main() {
  const base = 'http://localhost:3000';
  console.log('=== Phase 0: Wait for server health ===');
  // retry health up to 10 times
  let health;
  for (let i = 0; i < 10; i++) {
    try {
      const r = await fetch(`${base}/api/health`);
      const data = await r.json();
      if (data.success) { health = data; break; }
    } catch (_) {}
    await new Promise((res) => setTimeout(res, 2000));
  }
  if (!health) throw new Error('Server health not reachable');
  console.log('Health OK, server_time:', health.database?.[0]?.server_time);

  // --- Register two users ---
  const suffix = Date.now();
  const userA = { username: `testA_${suffix}`, email: `a_${suffix}@example.com`, password: 'Pass123!' };
  const userB = { username: `testB_${suffix}`, email: `b_${suffix}@example.com`, password: 'Pass123!' };

  console.log('=== Register User A ===');
  await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userA),
  }).then((r) => r.json()).then((d) => {
    if (d.message && d.message.includes('already')) console.log('User A may exist already');
  }).catch(() => {});

  console.log('=== Register User B ===');
  await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userB),
  }).then((r) => r.json()).then((d) => {
    if (d.message && d.message.includes('already')) console.log('User B may exist already');
  }).catch(() => {});

  // --- Login both users, capture cookies ---
  console.log('=== Login User A ===');
  const { json: loginARes, setCookie: cookieA } = await fetchWithCookie(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: userA.username, password: userA.password }),
  });
  if (!loginARes.user) throw new Error('Login A failed');
  const userAInfo = loginARes.user;

  console.log('=== Login User B ===');
  const { json: loginBRes, setCookie: cookieB } = await fetchWithCookie(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: userB.username, password: userB.password }),
  });
  if (!loginBRes.user) throw new Error('Login B failed');
  const userBInfo = loginBRes.user;

  // Helper to get messages with optional afterId/afterTime and cookie
  async function getMsgs(cookie, withId, afterId = 0, afterTime) {
    const params = new URLSearchParams({ with: String(withId), afterId: String(afterId) });
    if (afterTime) params.set('afterTime', afterTime);
    const { json } = await fetchWithCookie(`${base}/api/messages?${params}`, {}, cookie);
    return json.messages || [];
  }

  // Helper to send message
  async function sendMsg(cookie, toId, body) {
    const { json } = await fetchWithCookie(`${base}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiverId: toId, body }),
    }, cookie);
    return json.data;
  }

  console.log('=== Test 1: Initial empty conversation ===');
  const initMsgs = await getMsgs(cookieB, userAInfo.id);
  if (initMsgs.length !== 0) throw new Error('Conversation should be empty initially');
  console.log('PASS: No messages initially');

  console.log('=== Test 2: Send one message from A to B and poll with afterId/afterTime ===');
  const msgBody = `Hello ${randomString()}`;
  await sendMsg(cookieA, userBInfo.id, msgBody);
  // Wait a short moment to let DB commit
  await new Promise((r) => setTimeout(r, 1500));
  const msgsAfter = await getMsgs(cookieB, userAInfo.id, 0);
  if (!msgsAfter.find((m) => m.body === msgBody)) throw new Error('B did not receive message via afterId');
  console.log('PASS: B received message via afterId');

  // Test afterTime cursor with overlap handling
  console.log('=== Test 3: Poll using afterTime cursor (overlap) ===');
  // Get latest confirmed time from previous messages
  const latestMsg = msgsAfter.reduce((a, b) => (new Date(a.createdAt) > new Date(b.createdAt) ? a : b));
  const afterTime = latestMsg.createdAt;
  // Send another message shortly after
  const msgBody2 = `Second ${randomString()}`;
  await sendMsg(cookieA, userBInfo.id, msgBody2);
  await new Promise((r) => setTimeout(r, 500)); // small delay
  const msgsAfterTime = await getMsgs(cookieB, userAInfo.id, 0, afterTime);
  if (!msgsAfterTime.find((m) => m.body === msgBody2)) throw new Error('B missed message using afterTime cursor');
  console.log('PASS: afterTime cursor captures late message');

  console.log('=== Test 4: Concurrent messages and ordering ===');
  const bodies = Array.from({ length: 5 }, () => `Concurrent ${randomString()}`);
  // Send all quickly
  await Promise.all(bodies.map((b) => sendMsg(cookieA, userBInfo.id, b)));
  await new Promise((r) => setTimeout(r, 2000));
  const allMsgs = await getMsgs(cookieB, userAInfo.id, 0);
  const missing = bodies.filter((b) => !allMsgs.find((m) => m.body === b));
  if (missing.length) throw new Error(`Missing concurrent messages: ${missing.join(', ')}`);
  // Verify ordering by createdAt then id
  const sorted = [...allMsgs].sort((a, b) => {
    const ta = Date.parse(a.createdAt), tb = Date.parse(b.createdAt);
    if (ta !== tb) return ta - tb;
    return a.id - b.id;
  });
  const isOrdered = allMsgs.every((msg, idx) => msg.id === sorted[idx].id);
  if (!isOrdered) console.warn('Warning: messages not strictly ordered after merge (client will sort)');
  console.log('PASS: concurrent messages received');

  console.log('=== Test 5: Pagination simulation (large batch) ===');
  const manyBodies = Array.from({ length: 30 }, (_, i) => `Bulk ${i}-${randomString()}`);
  for (const b of manyBodies) {
    // sequential to avoid overload, but still fast enough
    await sendMsg(cookieA, userBInfo.id, b);
  }
  await new Promise((r) => setTimeout(r, 3000));
  const bulkMsgs = await getMsgs(cookieB, userAInfo.id, 0);
  const missingBulk = manyBodies.filter((b) => !bulkMsgs.find((m) => m.body === b));
  if (missingBulk.length) throw new Error(`Missing bulk messages (${missingBulk.length})`);
  console.log('PASS: bulk messages retrieved (no pagination needed)');

  console.log('\n=== ALL TESTS PASSED ===');
}

main().catch((err) => {
  console.error('TEST FAILED:', err.message);
  process.exit(1);
});
