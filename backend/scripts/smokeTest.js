/**
 * End-to-end smoke test against a RUNNING stack (backend + postgres [+ ML service]).
 *   npm run smoke                       (API_URL defaults to http://localhost:3001)
 *   EXPECT_ML=down npm run smoke        (assert graceful degradation when the ML service is stopped)
 */
const API = process.env.API_URL || 'http://localhost:3001';
const EXPECT_ML = process.env.EXPECT_ML || 'up';
let failed = 0;

const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) failed += 1;
};
const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch (_) { /* empty body */ }
  return { status: res.status, json };
};

(async () => {
  const stamp = Date.now().toString(36);
  const mk = async (tag) => {
    const r = await call('POST', '/api/auth/signup', {
      body: { email: `${tag}${stamp}@example.com`, username: `${tag}_${stamp}`, password: 'Passw0rdSmoke' },
    });
    return r.json.token;
  };
  const alice = await mk('alice');
  const bob = await mk('bob');
  check('signup returns tokens', !!alice && !!bob);

  const health = await call('GET', '/api/health');
  check('health is OK regardless of ML', health.status === 200 && health.json.status === 'OK');
  check(`ML reachable == ${EXPECT_ML === 'up'}`, health.json.ml.reachable === (EXPECT_ML === 'up'));

  const entries = [
    ['Great day', 'I felt genuinely happy today. My friends made me laugh and I feel so grateful and proud of myself.'],
    ['Exam panic', 'I am so anxious and stressed about the exam. I cannot sleep, I feel overwhelmed and scared of failing.'],
    ['Plain Tuesday', 'I went to class, did laundry, and bought groceries. Nothing else happened today.'],
  ];
  const created = [];
  for (const [title, body] of entries) {
    const r = await call('POST', '/api/journals', { token: alice, body: { title, body, visibility: 'private' } });
    check(`create "${title}" -> 201 even if ML is ${EXPECT_ML}`, r.status === 201, `analysis=${r.json.analysisStatus}`);
    created.push(r.json.journal);
  }

  if (EXPECT_ML === 'up') {
    check('entry 1 scored positive', created[0].sentimentLabel === 'positive', created[0].sentimentLabel);
    check('entry 2 scored negative', created[1].sentimentLabel === 'negative', created[1].sentimentLabel);
    check('entry 3 scored neutral', created[2].sentimentLabel === 'neutral', created[2].sentimentLabel);
    check('analysisStatus done + score in range', created.every((j) => j.analysisStatus === 'done' && Math.abs(j.sentimentScore) <= 1));

    const s = await call('GET', '/api/journals/search/semantic?q=' + encodeURIComponent('worried about my exam and cannot sleep'), { token: alice });
    check('semantic search mode', s.json.mode === 'semantic', `model=${s.json.embeddingModel}`);
    check('semantic search ranks the exam entry first', s.json.journals[0] && s.json.journals[0].title === 'Exam panic');

    const sim = await call('GET', `/api/journals/${created[1].id}/similar`, { token: alice });
    check('similar excludes itself', sim.status === 200 && sim.json.journals.every((j) => j.id !== created[1].id));

    const trend = await call('GET', '/api/journals/sentiment/trend?days=7', { token: alice });
    check('trend aggregates today', trend.status === 200 && trend.json.trend.length === 1 && trend.json.trend[0].entries === 3);

    const sb = await call('GET', '/api/journals/search/semantic?q=exam+anxiety', { token: bob });
    check("other users can't see my entries via search", sb.status === 200 && sb.json.count === 0);
    const sb2 = await call('GET', `/api/journals/${created[1].id}/similar`, { token: bob });
    check("other users can't call /similar on my entry (403)", sb2.status === 403);

    // privacy: public entry must not leak sentiment to others
    const pub = await call('POST', '/api/journals', { token: alice, body: { title: 'Public note', body: 'I am so sad and lonely today.', visibility: 'public' } });
    const asBob = await call('GET', `/api/journals/${pub.json.journal.id}`, { token: bob });
    check('non-owner view hides sentiment fields', asBob.status === 200 && asBob.json.journal.sentimentLabel === undefined && asBob.json.journal.sentimentDetails === undefined);
    const asAlice = await call('GET', `/api/journals/${pub.json.journal.id}`, { token: alice });
    check('owner view includes sentiment', asAlice.json.journal.sentimentLabel === 'negative');

    // edit re-analyses
    const upd = await call('PATCH', `/api/journals/${created[2].id}`, { token: alice, body: { body: 'I am thrilled and delighted, best news ever, I feel wonderful and so happy!' } });
    check('edit re-scores entry', upd.json.journal.sentimentLabel === 'positive', upd.json.journal.sentimentLabel);

    // delete cascades embedding
    const del = await call('DELETE', `/api/journals/${created[0].id}`, { token: alice });
    check('delete works', del.status === 200);
  } else {
    check('entries are queued as pending', created.every((j) => j.analysisStatus === 'pending' && j.sentimentLabel === null));
    const s = await call('GET', '/api/journals/search/semantic?q=exam', { token: alice });
    check('search falls back to keyword', s.status === 200 && s.json.mode === 'keyword' && s.json.count >= 1, `mode=${s.json.mode}`);
    const list = await call('GET', '/api/journals', { token: alice });
    check('journal list still works', list.status === 200);
    const t = await call('GET', '/api/journals/sentiment/trend', { token: alice });
    check('trend reports pending backlog', t.status === 200 && t.json.pendingAnalysis === 3, `pending=${t.json.pendingAnalysis}`);
  }

  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
