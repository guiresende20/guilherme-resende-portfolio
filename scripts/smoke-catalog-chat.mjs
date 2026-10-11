import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

// Local mode uses real Drive/Gemini, but disables chat-log writes. Production
// mode verifies the public API; credentials are never printed or saved.
const production = process.argv.includes('--production');
const origin = 'https://guiresende20.netlify.app';
const cases = [];
let server;
try {
  const response = await fetch(`${origin}/api/blog/list`, { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200);
  const { posts } = await response.json();
  assert.ok(Array.isArray(posts) && posts.length > 0);
  const pt = JSON.parse(readFileSync('src/locales/pt.json', 'utf8'));
  let handler;
  if (!production) {
    for (const file of ['.env', '.env.local']) {
      try { for (const [key, value] of Object.entries(parseEnv(readFileSync(file, 'utf8')))) if (value && !process.env[key]) process.env[key] = value; } catch {}
    }
    if (!process.env.GOOGLE_DRIVE_SA_JSON) {
      const pkg = JSON.parse(readFileSync('node_modules/netlify-cli/package.json', 'utf8'));
      const bin = typeof pkg.bin === 'string' ? pkg.bin : Object.values(pkg.bin)[0];
      let credential;
      try { credential = execFileSync(process.execPath, [resolve('node_modules/netlify-cli', bin), 'env:get', 'GOOGLE_DRIVE_SA_JSON', '--context', 'production', '--scope', 'functions'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 45000 }).trim(); }
      catch { throw new Error('Could not read configured Drive credentials'); }
      JSON.parse(credential);
      process.env.GOOGLE_DRIVE_SA_JSON = credential;
    }
    process.env.SUPABASE_URL = '';
    process.env.SUPABASE_SERVICE_ROLE_KEY = '';
    const { createServer } = await import('vite');
    server = await createServer({ configFile: false, resolve: { alias: { '@': resolve('src') } }, optimizeDeps: { entries: [] }, server: { middlewareMode: true }, appType: 'custom' });
    ({ handler } = await server.ssrLoadModule('/netlify/functions/chat.ts'));
  }
  const call = async (message, history = []) => {
    const started = Date.now();
    let status, body, retrieval;
    if (production) {
      const result = await fetch(`${origin}/api/chat`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ message, history }), signal: AbortSignal.timeout(30000) });
      status = result.status; body = await result.json(); retrieval = result.headers.get('x-chat-retrieval-status');
    } else {
      const result = await handler({ httpMethod: 'POST', headers: { origin }, body: JSON.stringify({ message, history }) }, {}, () => {});
      status = result.statusCode; body = JSON.parse(result.body); retrieval = result.headers?.['X-Chat-Retrieval-Status'];
    }
    const item = { message, status, elapsedMs: Date.now() - started, retrieval, body };
    cases.push(item);
    console.log(JSON.stringify(item));
    assert.equal(status, 200, `Failed request: ${message}`);
    assert.ok(body.text.length <= 800);
    return body;
  };
  const countIs = (body, expected) => assert.match(body.text, new RegExp(`\\b${expected}\\s+(?:posts|published posts|projetos|artigos)`));
  const list = await call('lista os meus posts e os titulos deles');
  assert.ok(list.actions.some(action => action.type === 'link' && action.url === '/blog'));
  for (const post of posts) assert.ok(list.text.includes(post.title), `Missing published title: ${post.title}`);
  countIs(await call('Count my blog posts'), posts.length);
  const juneQuestion = 'Liste os posts de junho de 2026';
  const junePosts = posts.filter(post => post.date >= '2026-06-01' && post.date <= '2026-06-30');
  const june = await call(juneQuestion);
  for (const post of junePosts) assert.ok(june.text.includes(post.title));
  for (const post of posts.filter(post => !junePosts.includes(post))) assert.ok(!june.text.includes(post.title));
  countIs(await call('e quantos posts?', [{ role: 'user', parts: [{ text: juneQuestion }] }, { role: 'model', parts: [{ text: june.text }] }]), junePosts.length);
  const recent = await call('Liste seus três últimos posts');
  const newest = posts.slice().sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug)).slice(0, 3);
  for (const post of newest) assert.ok(recent.text.includes(post.title));
  assert.equal((recent.text.match(/^\d+\. /gm) ?? []).length, 3);
  countIs(await call('Quantos projetos estão listados no seu portfólio?'), pt.projects.items.length);
  const papers = await call('Quantos artigos científicos você publicou?');
  assert.match(papers.text, /parcial/);
  assert.match(papers.text, /não consigo confirmar o total/);
  const ambiguous = await call('Liste os posts de junho');
  assert.match(ambiguous.text, /ano/);
  const error = 'Não consegui responder com segurança agora. Tente novamente em instantes.';
  const failure = await call('pq nao conseguiu ?', [{ role: 'user', parts: [{ text: 'Lista seus posts' }] }, { role: 'model', parts: [{ text: error }] }]);
  assert.match(failure.text, /falhou/);
  assert.doesNotMatch(failure.text, /contrato|palestra/);
  const normalize = text => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ');
  const aiCount = posts.filter(post => /(?:^| )(?:ia|ai|inteligencia artificial|artificial intelligence)(?: |$)/.test(normalize([post.title, post.excerpt ?? '', ...(post.tags ?? [])].join(' ')))).length;
  countIs(await call('Quantos posts sobre IA você publicou?'), aiCount);
  console.log(`PASS: ${cases.length} ${production ? 'production' : 'local'} requests, ${posts.length} published titles, period and topic counts, history, projects and partial academic catalog.`);
} catch (error) {
  console.error(JSON.stringify({ verification: 'failed', name: error.name, message: error.message }));
  process.exitCode = 1;
} finally {
  await server?.close();
  mkdirSync('tmp', { recursive: true });
  writeFileSync(`tmp/catalog-chat-${production ? 'production' : 'local'}-smoke.json`, JSON.stringify({ date: new Date().toISOString(), production, passed: !process.exitCode, cases }, null, 2));
}
