import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'

const HOST = process.env.MEDIA_PROXY_HOST || '0.0.0.0'
const PORT = Number(process.env.MEDIA_PROXY_PORT || '16810')
const PROXY_PATH = '/api/webdav/media'
const HTTP_PROXY_PATH = '/api/webdav/http'
const HEALTH_PATH = '/healthz'
const STATUS_PATH = '/api/admin/status'
const DASHBOARD_PATHS = new Set(['/', '/dashboard'])
const MAX_RECENT_REQUESTS = Number(process.env.MEDIA_PROXY_RECENT_LIMIT || '120')

const BILIBILI_HEADERS = { Referer: 'https://www.bilibili.com/', Origin: 'https://www.bilibili.com' }
const BAIDU_HEADERS = { Referer: 'https://pan.baidu.com/', Origin: 'https://pan.baidu.com', 'User-Agent': 'pan.baidu.com' }
const ALI_HEADERS = { Referer: 'https://www.alipan.com/', Origin: 'https://www.alipan.com' }

const SPECIAL_PROXY_RULES = [
  [/(^|\.)bilivideo\.com$/i, BILIBILI_HEADERS],
  [/(^|\.)bilivideo\.cn$/i, BILIBILI_HEADERS],
  [/(^|\.)hdslb\.com$/i, BILIBILI_HEADERS],
  [/(^|\.)comment\.bilibili\.com$/i, BILIBILI_HEADERS],
  [/(^|\.)pan\.baidu\.com$/i, BAIDU_HEADERS],
  [/(^|\.)v1-ant\.baidu\.com$/i, BAIDU_HEADERS],
  [/(^|\.)(?:d|qdall)\.pcs\.baidu\.com$/i, BAIDU_HEADERS],
  [/(^|\.)aliyundrive\.cloud$/i, ALI_HEADERS],
  [/(^|\.)aliyunpds\.com$/i, ALI_HEADERS],
]

const RESPONSE_HEADER_BLACKLIST = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-length',
  'location',
  'access-control-allow-origin',
  'access-control-allow-methods',
  'access-control-allow-headers',
])

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range, Authorization',
}

const cookieJar = new Map()
const metrics = {
  startedAt: Date.now(),
  total: 0,
  success: 0,
  errors: 0,
  active: 0,
  bytesSent: 0,
  hosts: new Map(),
  recent: [],
}

const json = (res, statusCode, payload, headers = {}) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS, ...headers })
  res.end(JSON.stringify(payload))
}

const html = (res, statusCode, body) => {
  res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(body)
}

const getSpecialProxyHeaders = (target) =>
  SPECIAL_PROXY_RULES.find(([host]) => host.test(target.hostname))?.[1] || {}

const getJarKey = (targetUrl) => targetUrl.hostname

const getCookieHeader = (targetUrl) => {
  const jar = cookieJar.get(getJarKey(targetUrl))
  return jar ? Array.from(jar.entries()).map(([key, value]) => `${key}=${value}`).join('; ') : ''
}

const storeSetCookie = (targetUrl, raw) => {
  if (!raw) return
  const jar = cookieJar.get(getJarKey(targetUrl)) || new Map()
  for (const item of Array.isArray(raw) ? raw : [raw]) {
    const first = String(item).split(';')[0]
    const index = first.indexOf('=')
    if (index <= 0) continue
    jar.set(first.slice(0, index).trim(), first.slice(index + 1).trim())
  }
  cookieJar.set(getJarKey(targetUrl), jar)
}

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = []
  req.on('data', (chunk) => chunks.push(chunk))
  req.on('end', () => resolve(Buffer.concat(chunks)))
  req.on('error', reject)
})

const copyResponseHeaders = (headers = {}) => {
  const next = {}
  for (const key of Object.keys(headers)) {
    if (!RESPONSE_HEADER_BLACKLIST.has(key.toLowerCase())) next[key] = headers[key]
  }
  return {
    ...next,
    ...CORS_HEADERS,
  }
}

const buildProxyUrl = (url, options = {}) => {
  const proxy = new URL(PROXY_PATH, `http://127.0.0.1:${PORT}`)
  proxy.searchParams.set('url', url)
  if (options.auth) proxy.searchParams.set('auth', options.auth)
  if (options.cookie) proxy.searchParams.set('cookie', options.cookie)
  return proxy.toString()
}

const rewritePlaylistBody = (body, targetUrl, options) =>
  String(body || '').split(/\r?\n/).map((line) => {
    const replaceUrl = (value) => {
      try {
        return buildProxyUrl(new URL(value, targetUrl).toString(), options)
      } catch {
        return value
      }
    }

    const withUri = line.replace(/URI="([^"]+)"/g, (_, value) => `URI="${replaceUrl(value)}"`)
    const trimmed = withUri.trim()
    if (!trimmed || trimmed.startsWith('#')) return withUri
    return replaceUrl(trimmed)
  }).join('\n')

const shouldRewritePlaylist = (targetUrl, headers = {}) => {
  const contentType = String(headers['content-type'] || headers['Content-Type'] || '')
  return /\.m3u8([?#]|$)/i.test(targetUrl.toString()) || /mpegurl|application\/x-mpegurl|application\/vnd\.apple\.mpegurl/i.test(contentType)
}

const startRequestLog = (requestUrl, targetUrl) => {
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: new Date().toISOString(),
    method: requestUrl.method || 'GET',
    path: requestUrl.pathname || '',
    target: targetUrl?.toString?.() || '',
    host: targetUrl?.hostname || '-',
    status: 'pending',
    durationMs: 0,
    bytes: 0,
    contentType: '',
    error: '',
  }
  metrics.total += 1
  metrics.active += 1
  metrics.recent.unshift(item)
  if (metrics.recent.length > MAX_RECENT_REQUESTS) metrics.recent.length = MAX_RECENT_REQUESTS
  const hostStats = metrics.hosts.get(item.host) || { total: 0, success: 0, errors: 0 }
  hostStats.total += 1
  metrics.hosts.set(item.host, hostStats)
  const started = Date.now()
  return {
    finish(statusCode, contentType = '', bytes = 0, error = '') {
      item.status = error ? `error:${statusCode}` : String(statusCode)
      item.durationMs = Date.now() - started
      item.bytes = bytes
      item.contentType = contentType
      item.error = error
      metrics.active = Math.max(0, metrics.active - 1)
      metrics.bytesSent += bytes
      const current = metrics.hosts.get(item.host)
      if (current) {
        if (error || statusCode >= 400) current.errors += 1
        else current.success += 1
      }
      if (error || statusCode >= 400) metrics.errors += 1
      else metrics.success += 1
    },
  }
}

const getStatusPayload = () => ({
  ok: true,
  host: HOST,
  port: PORT,
  uptimeMs: Date.now() - metrics.startedAt,
  totals: {
    total: metrics.total,
    success: metrics.success,
    errors: metrics.errors,
    active: metrics.active,
    bytesSent: metrics.bytesSent,
  },
  hosts: Array.from(metrics.hosts.entries())
    .map(([host, value]) => ({ host, ...value }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20),
  recent: metrics.recent,
})

const renderDashboard = () => `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SiYuan Media Proxy</title>
  <style>
    :root {
      --bg: #0b1220;
      --panel: rgba(12, 18, 33, 0.88);
      --panel-2: rgba(18, 28, 49, 0.92);
      --border: rgba(148, 163, 184, 0.18);
      --text: #e5eefb;
      --muted: #9fb0c7;
      --good: #3ddc97;
      --warn: #f7b84b;
      --bad: #ff6b6b;
      --accent: #69b1ff;
      --shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--text);
      font: 14px/1.55 "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(105, 177, 255, 0.22), transparent 30%),
        radial-gradient(circle at top right, rgba(61, 220, 151, 0.16), transparent 25%),
        linear-gradient(180deg, #08101c 0%, #0d1728 52%, #0a1220 100%);
      min-height: 100vh;
    }
    .wrap { max-width: 1240px; margin: 0 auto; padding: 32px 20px 48px; }
    .hero {
      display: grid;
      gap: 18px;
      grid-template-columns: 1.3fr 0.9fr;
      margin-bottom: 20px;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 24px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(14px);
    }
    .hero-main { padding: 28px; }
    .hero-side { padding: 24px; display: grid; gap: 14px; align-content: start; }
    h1 { margin: 0 0 10px; font-size: 34px; letter-spacing: 0.02em; }
    .subtitle { color: var(--muted); max-width: 760px; }
    .badge-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(105, 177, 255, 0.12);
      border: 1px solid rgba(105, 177, 255, 0.18);
      color: #dcecff;
      font-size: 12px;
    }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--good); box-shadow: 0 0 14px rgba(61, 220, 151, 0.9); }
    .meta { display: grid; gap: 10px; color: var(--muted); }
    .meta code, .code {
      color: var(--text);
      background: rgba(255,255,255,0.06);
      padding: 2px 8px;
      border-radius: 8px;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      margin-bottom: 20px;
    }
    .stat {
      padding: 18px 18px 16px;
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: 20px;
      min-height: 108px;
    }
    .stat-label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
    .stat-value { margin-top: 10px; font-size: 32px; font-weight: 700; }
    .stat-desc { margin-top: 8px; color: var(--muted); }
    .grid {
      display: grid;
      gap: 20px;
      grid-template-columns: 0.9fr 1.1fr;
    }
    .section { padding: 22px; }
    .section h2 { margin: 0 0 14px; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; }
    th, td {
      text-align: left;
      padding: 11px 10px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.1);
      vertical-align: top;
    }
    th { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
    td { color: var(--text); }
    .host-cell, .target-cell {
      max-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .status-good { color: var(--good); }
    .status-bad { color: var(--bad); }
    .status-pending { color: var(--warn); }
    .footer {
      margin-top: 18px;
      color: var(--muted);
      font-size: 12px;
      text-align: right;
    }
    @media (max-width: 980px) {
      .hero, .grid, .stats { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <div class="panel hero-main">
        <h1>SiYuan Media Proxy</h1>
        <div class="subtitle">独立媒体代理服务状态页。这里可以直接查看服务是否在线、最近代理的请求、常见目标站点命中情况，以及当前吞吐与错误趋势。</div>
        <div class="badge-row">
          <span class="badge"><span class="dot"></span> 服务运行中</span>
          <span class="badge">状态接口 <span class="code">${STATUS_PATH}</span></span>
          <span class="badge">健康检查 <span class="code">${HEALTH_PATH}</span></span>
        </div>
      </div>
      <div class="panel hero-side">
        <div class="meta"><strong>部署地址</strong><span id="bindInfo">加载中...</span></div>
        <div class="meta"><strong>代理接口</strong><span><code>${PROXY_PATH}</code></span></div>
        <div class="meta"><strong>最近刷新</strong><span id="updatedAt">-</span></div>
      </div>
    </section>
    <section class="stats">
      <div class="panel stat"><div class="stat-label">总请求数</div><div class="stat-value" id="totalRequests">-</div><div class="stat-desc">自启动以来累计</div></div>
      <div class="panel stat"><div class="stat-label">成功请求</div><div class="stat-value" id="successRequests">-</div><div class="stat-desc">2xx / 3xx 成功转发</div></div>
      <div class="panel stat"><div class="stat-label">错误请求</div><div class="stat-value" id="errorRequests">-</div><div class="stat-desc">4xx / 5xx 或代理失败</div></div>
      <div class="panel stat"><div class="stat-label">活动请求</div><div class="stat-value" id="activeRequests">-</div><div class="stat-desc">当前进行中的代理</div></div>
    </section>
    <section class="grid">
      <div class="panel section">
        <h2>站点统计</h2>
        <table>
          <thead><tr><th>Host</th><th>总数</th><th>成功</th><th>错误</th></tr></thead>
          <tbody id="hostTable"></tbody>
        </table>
      </div>
      <div class="panel section">
        <h2>最近请求</h2>
        <table>
          <thead><tr><th>时间</th><th>方法</th><th>状态</th><th>耗时</th><th>目标</th></tr></thead>
          <tbody id="recentTable"></tbody>
        </table>
      </div>
    </section>
    <div class="footer">页面每 3 秒自动刷新一次</div>
  </div>
  <script>
    const formatDuration = (ms) => {
      if (ms < 1000) return ms + ' ms'
      if (ms < 60000) return (ms / 1000).toFixed(2) + ' s'
      return (ms / 60000).toFixed(1) + ' min'
    }
    const formatNumber = (value) => new Intl.NumberFormat('zh-CN').format(Number(value || 0))
    const statusClass = (value) => value === 'pending' ? 'status-pending' : (String(value).startsWith('2') || String(value).startsWith('3') ? 'status-good' : 'status-bad')

    async function refresh() {
      const res = await fetch('${STATUS_PATH}', { cache: 'no-store' })
      const data = await res.json()
      document.getElementById('bindInfo').textContent = data.host + ':' + data.port
      document.getElementById('updatedAt').textContent = new Date().toLocaleString()
      document.getElementById('totalRequests').textContent = formatNumber(data.totals.total)
      document.getElementById('successRequests').textContent = formatNumber(data.totals.success)
      document.getElementById('errorRequests').textContent = formatNumber(data.totals.errors)
      document.getElementById('activeRequests').textContent = formatNumber(data.totals.active)

      document.getElementById('hostTable').innerHTML = (data.hosts.length ? data.hosts : [{ host: '-', total: 0, success: 0, errors: 0 }]).map((item) => \`
        <tr>
          <td class="host-cell" title="\${item.host}">\${item.host}</td>
          <td>\${formatNumber(item.total)}</td>
          <td class="status-good">\${formatNumber(item.success)}</td>
          <td class="status-bad">\${formatNumber(item.errors)}</td>
        </tr>\`).join('')

      document.getElementById('recentTable').innerHTML = (data.recent.length ? data.recent : [{ startedAt: '-', method: '-', status: '-', durationMs: 0, target: '-', error: '' }]).map((item) => \`
        <tr>
          <td>\${item.startedAt === '-' ? '-' : new Date(item.startedAt).toLocaleTimeString()}</td>
          <td>\${item.method}</td>
          <td class="\${statusClass(item.status)}">\${item.status}</td>
          <td>\${formatDuration(item.durationMs || 0)}</td>
          <td class="target-cell" title="\${item.error || item.target}">\${item.error || item.target}</td>
        </tr>\`).join('')
    }

    refresh().catch(console.error)
    setInterval(() => refresh().catch(console.error), 3000)
  </script>
</body>
</html>`

const proxyHttpRequest = ({ targetUrl, method = 'GET', headers = {}, body = '' }) => new Promise((resolve, reject) => {
  const protocol = targetUrl.protocol === 'https:' ? https : http
  const request = protocol.request({
    hostname: targetUrl.hostname,
    port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
    path: targetUrl.pathname + targetUrl.search,
    method,
    headers,
  }, (response) => resolve(response))
  request.on('error', reject)
  if (body && !['GET', 'HEAD'].includes(method)) request.write(body)
  request.end()
})

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || `127.0.0.1:${PORT}`}`)

  if (DASHBOARD_PATHS.has(requestUrl.pathname)) return html(res, 200, renderDashboard())
  if (requestUrl.pathname === HEALTH_PATH) return json(res, 200, { ok: true, uptimeMs: Date.now() - metrics.startedAt })
  if (requestUrl.pathname === STATUS_PATH) return json(res, 200, getStatusPayload())

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS)
    res.end()
    return
  }

  if (![PROXY_PATH, HTTP_PROXY_PATH].includes(requestUrl.pathname)) {
    return json(res, 404, { code: -1, msg: 'Not Found' })
  }

  if (requestUrl.pathname === HTTP_PROXY_PATH) {
    let targetUrl = null
    let requestLog = null
    try {
      const raw = await readBody(req)
      const { url: dest, method = 'GET', headers = {}, body = '' } = JSON.parse(String(raw || '{}'))
      if (!dest) throw new Error('Missing url')
      targetUrl = new URL(dest)
      requestLog = startRequestLog(requestUrl, targetUrl)

      const mergedHeaders = { ...headers }
      const jarCookie = getCookieHeader(targetUrl)
      mergedHeaders.Cookie = [jarCookie, mergedHeaders.Cookie].filter(Boolean).join('; ')

      const proxyRes = await proxyHttpRequest({ targetUrl, method, headers: mergedHeaders, body })
      const chunks = []
      proxyRes.on('data', (chunk) => chunks.push(chunk))
      proxyRes.on('end', () => {
        const payload = Buffer.concat(chunks)
        storeSetCookie(targetUrl, proxyRes.headers['set-cookie'])
        requestLog.finish(proxyRes.statusCode || 500, String(proxyRes.headers['content-type'] || ''), payload.byteLength)
        json(res, 200, {
          status: proxyRes.statusCode || 500,
          body: payload.toString('utf8'),
          headers: proxyRes.headers,
        })
      })
      return
    } catch (error) {
      if (requestLog) requestLog.finish(400, '', 0, error?.message || 'Bad Request')
      return json(res, 400, { status: 400, body: error?.message || 'Bad Request', headers: {} })
    }
  }

  const destURL = requestUrl.searchParams.get('url')
  const auth = requestUrl.searchParams.get('auth') || ''
  const cookie = requestUrl.searchParams.get('cookie') || ''
  if (!destURL) return json(res, 400, { code: -1, msg: 'Missing url parameter' })

  let targetUrl
  try {
    targetUrl = new URL(destURL)
  } catch {
    return json(res, 400, { code: -1, msg: 'Invalid URL' })
  }

  const requestLog = startRequestLog(requestUrl, targetUrl)
  const headers = {
    'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
    ...(req.headers.range ? { Range: req.headers.range } : {}),
    ...(req.headers.accept ? { Accept: req.headers.accept } : {}),
    ...getSpecialProxyHeaders(targetUrl),
  }
  if (auth) headers.Authorization = decodeURIComponent(auth)
  if (cookie) headers.Cookie = decodeURIComponent(cookie)

  const pipeTarget = (nextUrl, redirectCount = 0) => {
    const protocol = nextUrl.protocol === 'https:' ? https : http
    const proxyReq = protocol.request({
      hostname: nextUrl.hostname,
      port: nextUrl.port || (nextUrl.protocol === 'https:' ? 443 : 80),
      path: nextUrl.pathname + nextUrl.search,
      method: req.method,
      headers,
    }, (proxyRes) => {
      const statusCode = proxyRes.statusCode || 500
      const location = proxyRes.headers.location

      if (location && [301, 302, 303, 307, 308].includes(statusCode) && redirectCount < 5) {
        proxyRes.resume()
        pipeTarget(new URL(location, nextUrl), redirectCount + 1)
        return
      }

      storeSetCookie(nextUrl, proxyRes.headers['set-cookie'])

      if (shouldRewritePlaylist(nextUrl, proxyRes.headers)) {
        const chunks = []
        proxyRes.on('data', (chunk) => chunks.push(chunk))
        proxyRes.on('end', () => {
          const body = rewritePlaylistBody(Buffer.concat(chunks).toString('utf8'), nextUrl, { auth, cookie })
          const bytes = Buffer.byteLength(body)
          requestLog.finish(statusCode, String(proxyRes.headers['content-type'] || ''), bytes)
          res.writeHead(statusCode, copyResponseHeaders(proxyRes.headers))
          res.end(body)
        })
        return
      }

      let bytes = 0
      proxyRes.on('data', (chunk) => { bytes += chunk.length })
      proxyRes.on('end', () => {
        requestLog.finish(statusCode, String(proxyRes.headers['content-type'] || ''), bytes)
      })

      res.writeHead(statusCode, copyResponseHeaders(proxyRes.headers))
      proxyRes.pipe(res)
    })

    proxyReq.on('error', (error) => {
      requestLog.finish(502, '', 0, error.message)
      if (!res.headersSent) json(res, 502, { code: -1, msg: 'Proxy request failed', detail: error.message })
    })

    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method || 'GET')) proxyReq.end()
    else req.pipe(proxyReq)
  }

  pipeTarget(targetUrl)
})

server.listen(PORT, HOST, () => {
  console.log(`[Media-Proxy] listening on ${HOST}:${PORT}`)
  console.log(`[Media-Proxy] dashboard: http://127.0.0.1:${PORT}/`)
})
