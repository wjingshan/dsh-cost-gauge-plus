/**
 * dsh-cost-gauge-plus 浏览器半身 —— 左上角浮动窗口，支持多皮肤切换。
 *
 * 数据层（宿主 /api/cost-gauge-plus/state）所有皮肤共用；表现层由皮肤注册表分发：
 *   - classic  经典时钟（表盘 + 上弧里程表 + 翻牌时间 + 双状态灯）
 *   - minimal  极简数字（话费/余额/命中率/模型 + 状态灯）
 *   - ring     环形仪表（中间大数字余额 + 外圈进度环）
 *   - bar      迷你状态条（一行横向）
 *
 * 共用：数据轮询、每秒 tick、阈值/位置/大小/皮肤偏好、余额告警、明暗主题。
 * 数据经 `/api/cost-gauge-plus/state?session=<id>` 拉取；零依赖、纯原生 JS。
 */
window.__ModuleLoader__.load({
  id: 'dsh-cost-gauge-plus',
  factory: () => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const inject = ['sessions']

    const LS_PREFIX = 'dsh-cost-gauge-plus'
    const DEFAULT_THRESHOLD = 10
    const POLL_MS = 5000
    const MIN_W = 200
    const MAX_W = 480
    const DEFAULT_W = 264

    const COL = {
      idleRing: '#a9cc72',
      busyRing: '#fac000',
      odoGreen: '#40b25d',
      odoRed: '#c30d23',
      odoNeedle: '#f39800',
      statusIdle: '#22ac38',
      statusBusy: '#fac000',
      accent: '#c4e1f6',
    }

    const CSS = `
.cgp-root{position:fixed;z-index:2147483000;width:${DEFAULT_W}px;box-sizing:border-box;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
  --cgp-bg:#000;--cgp-fg:#f5f5f5;--cgp-muted:#949494;
  --cgp-border:rgba(255,255,255,.16);--cgp-input-bg:rgba(255,255,255,.08);
  --cgp-pill-bg:#000;--cgp-pill-border:rgba(255,255,255,.32);
  --cgp-track:rgba(255,255,255,.12);--cgp-resize:rgba(255,255,255,.4);
  --cgp-flap-bg:#101010;--cgp-flap-fg:#f5f5f5;
  --cgp-disc:rgba(255,255,255,.045);
  --cgp-accent:${COL.accent};
  background:var(--cgp-bg);color:var(--cgp-fg);border:1px solid var(--cgp-border);
  border-radius:16px;box-shadow:0 12px 34px rgba(0,0,0,.5);padding:9px 12px 11px;
  user-select:none;-webkit-user-select:none}
@media (prefers-color-scheme: light){
  .cgp-root{--cgp-bg:#ffffff;--cgp-fg:#161616;--cgp-muted:#6d6d6d;
    --cgp-border:rgba(0,0,0,.16);--cgp-input-bg:rgba(0,0,0,.05);
    --cgp-pill-bg:#ffffff;--cgp-pill-border:rgba(0,0,0,.35);
    --cgp-track:rgba(0,0,0,.12);--cgp-resize:rgba(0,0,0,.4);
    --cgp-flap-bg:#e8e8e8;--cgp-flap-fg:#161616;
    --cgp-disc:transparent;
    --cgp-accent:#2f6fb3;box-shadow:none}
  /* 浅色主题去掉所有阴影效果 */
  .cgp-ring,.cgp-ring-arc,.cgp-pill{filter:none}
  .cgp-flapboard,.cgp-model-pill{box-shadow:none}
}
.cgp-title{display:flex;align-items:center;gap:6px;cursor:grab;padding-bottom:7px;
  border-bottom:1px solid var(--cgp-border);margin-bottom:7px}
.cgp-title:active{cursor:grabbing}
.cgp-title-text{flex:1;font-size:13px;font-weight:700;color:var(--cgp-fg);white-space:nowrap}
.cgp-alarm-dot{width:8px;height:8px;border-radius:50%;background:${COL.odoRed};flex:none;display:none}
.cgp-root.cgp-alarm .cgp-alarm-dot{display:block;animation:cgp-blink 1s ease-in-out infinite}
@keyframes cgp-blink{0%,100%{opacity:1;box-shadow:0 0 8px 2px rgba(195,13,35,.85)}
  50%{opacity:.12;box-shadow:none}}
.cgp-toggle,.cgp-gear{flex:none;border:none;background:transparent;color:var(--cgp-muted);cursor:pointer;
  font-size:15px;line-height:1;padding:2px 3px;width:20px;text-align:center}
.cgp-toggle:hover,.cgp-gear:hover{color:var(--cgp-fg)}
.cgp-gear{font-size:13px;color:var(--cgp-accent)}

.cgp-row{display:flex;justify-content:space-between;align-items:center;font-size:12px;
  color:var(--cgp-muted);padding:3px 0;line-height:1.2}
.cgp-val{color:var(--cgp-fg);font-variant-numeric:tabular-nums;font-weight:700}

/* 设置面板 */
.cgp-settings{display:none;margin-top:8px;padding-top:8px;border-top:1px solid var(--cgp-border)}
.cgp-root.cgp-settings-open .cgp-settings{display:block}
.cgp-settings label{font-size:11px;color:var(--cgp-muted);display:block;margin-bottom:4px}
.cgp-skin,.cgp-threshold{width:100%;box-sizing:border-box;background:var(--cgp-input-bg);
  border:1px solid var(--cgp-border);border-radius:8px;color:var(--cgp-fg);font-size:13px;padding:6px 8px}
.cgp-skin option{background:var(--cgp-bg);color:var(--cgp-fg)}
.cgp-threshold:focus,.cgp-skin:focus{outline:none;border-color:var(--cgp-accent)}
.cgp-pref-row{display:flex;align-items:center;gap:8px;margin-top:8px}
.cgp-pref-row label{font-size:11px;color:var(--cgp-muted);margin-bottom:0;display:block;flex:1}
.cgp-ring-w{width:56px;box-sizing:border-box;background:var(--cgp-input-bg);
  border:1px solid var(--cgp-border);border-radius:6px;color:var(--cgp-fg);font-size:12px;padding:4px 6px}
.cgp-color{width:34px;height:24px;padding:0;border:1px solid var(--cgp-border);
  border-radius:6px;background:transparent;cursor:pointer}
.cgp-color::-webkit-color-swatch-wrapper{padding:2px}
.cgp-color::-webkit-color-swatch{border:none;border-radius:4px}

.cgp-resizer{position:absolute;right:0;bottom:0;width:20px;height:20px;cursor:nwse-resize;touch-action:none}
.cgp-resizer::after{content:'';position:absolute;right:4px;bottom:4px;width:10px;height:10px;
  border-right:2px solid var(--cgp-resize);border-bottom:2px solid var(--cgp-resize);
  border-bottom-right-radius:3px}

/* ===== 经典时钟 ===== */
.cgp-clock{position:relative}
.cgp-clock svg{display:block;width:100%;height:auto}
.cgp-flapboard{position:absolute;left:50%;top:36%;transform:translate(-50%,-50%);
  display:flex;align-items:center;gap:1px;background:var(--cgp-pill-bg);
  border:1px solid var(--cgp-pill-border);border-radius:7px;padding:1.5px 3px;box-sizing:border-box;
  box-shadow:0 3px 10px rgba(0,0,0,.45)}
.cgp-flap-cell{position:relative;width:16px;height:21px;overflow:hidden;perspective:100px;
  background:var(--cgp-flap-bg);border-radius:3px}
.cgp-flap-char{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:16px;font-weight:700;color:var(--cgp-flap-fg);font-variant-numeric:tabular-nums;
  transform-origin:50% 0%}
.cgp-flap-colon{font-size:16px;font-weight:700;color:var(--cgp-fg);padding:0;line-height:1}
.cgp-flap-out{animation:cgp-flap-out .16s ease-in forwards;transform-origin:50% 0%}
.cgp-flap-in{animation:cgp-flap-in .22s ease-out both;transform-origin:50% 100%}
@keyframes cgp-flap-out{from{transform:rotateX(0deg);opacity:1}to{transform:rotateX(-90deg);opacity:.1}}
@keyframes cgp-flap-in{from{transform:rotateX(90deg);opacity:.1}to{transform:rotateX(0deg);opacity:1}}
.cgp-disc{fill:var(--cgp-disc)}
.cgp-ring{filter:url(#cgp-shadow)}
.cgp-ring-base{fill:none;stroke-width:10}
.cgp-ring-arc{fill:none;stroke-width:10;stroke-linecap:round;filter:url(#cgp-stack-green)}
.cgp-hand{transform-box:view-box;transform-origin:100px 100px;transform:rotate(0deg);
  transition:transform .6s cubic-bezier(.4,1.4,.6,1);filter:url(#cgp-glow-white)}
.cgp-hand line{stroke:var(--cgp-fg);stroke-width:3;stroke-linecap:round}
.cgp-hand circle{fill:var(--cgp-fg)}
.cgp-hub{fill:var(--cgp-fg);filter:url(#cgp-glow-white)}
.cgp-odo-track{fill:none;stroke:var(--cgp-track);stroke-width:11;stroke-linecap:round}
.cgp-odo-red{fill:none;stroke:${COL.odoRed};stroke-width:11;stroke-linecap:round;filter:url(#cgp-glow-red)}
.cgp-odo-fuel{fill:none;stroke:url(#cgp-odo-grad);stroke-width:11;stroke-linecap:round;filter:url(#cgp-glow-green)}
.cgp-odo-needle{stroke:${COL.odoNeedle};stroke-width:2.5;stroke-linecap:round;filter:url(#cgp-glow-orange)}
.cgp-odo-label{fill:var(--cgp-muted);font-size:11px;font-variant-numeric:tabular-nums}
.cgp-pill{fill:var(--cgp-pill-bg);stroke:var(--cgp-pill-border);stroke-width:.8;filter:url(#cgp-shadow)}
.cgp-pill-text{fill:var(--cgp-fg);font-size:12px;font-weight:700;text-anchor:middle;
  dominant-baseline:central;font-variant-numeric:tabular-nums}
.cgp-hit-label{fill:var(--cgp-muted);font-size:8.5px;text-anchor:middle}
.cgp-stars{pointer-events:none}
.cgp-status-row{display:flex;justify-content:space-between;align-items:center;gap:8px;
  font-size:10.5px;margin-bottom:5px;min-height:13px}
.cgp-status{font-weight:700}
.cgp-status.cgp-idle{color:${COL.statusIdle}}
.cgp-status.cgp-busy{color:${COL.statusBusy}}
.cgp-countdown{color:var(--cgp-muted);white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:700}
.cgp-bottom{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-top:5px}
.cgp-rows{flex:1;min-width:0}
.cgp-model{flex:none}
.cgp-model-pill{display:inline-block;position:relative;perspective:90px;
  background:var(--cgp-pill-bg);border:1px solid var(--cgp-pill-border);
  border-radius:8px;color:var(--cgp-fg);font-size:11px;font-weight:700;
  padding:3px 10px;box-shadow:0 2px 6px rgba(0,0,0,.35)}
.cgp-model-measure{visibility:hidden;white-space:nowrap;line-height:14px}
.cgp-model-inner{position:absolute;left:10px;right:10px;top:3px;line-height:14px;
  white-space:nowrap;text-align:center}
.cgp-model-out{animation:cgp-model-out .18s ease-in forwards;transform-origin:50% 0%}
.cgp-model-in{animation:cgp-model-in .24s ease-out both;transform-origin:50% 100%}
@keyframes cgp-model-out{from{transform:rotateX(0deg);opacity:1}to{transform:rotateX(-90deg);opacity:.1}}
@keyframes cgp-model-in{from{transform:rotateX(90deg);opacity:.1}to{transform:rotateX(0deg);opacity:1}}
.cgp-compact{display:none}
.cgp-collapsed .cgp-compact{display:block}
.cgp-collapsed .cgp-status-row,.cgp-collapsed .cgp-clock,.cgp-collapsed .cgp-bottom,
.cgp-collapsed .cgp-settings,.cgp-collapsed .cgp-resizer,.cgp-collapsed .cgp-gear{display:none}
.cgp-collapsed{width:176px}
.cgp-lamps{display:flex;align-items:center;gap:14px;margin-top:8px}
.cgp-lamp{display:flex;align-items:center;gap:5px;opacity:.16}
.cgp-lamp svg{display:block}
.cgp-idle .cgp-lamp.cgp-lamp-idle,.cgp-busy .cgp-lamp.cgp-lamp-busy{opacity:1}
.cgp-lamp-dot{transition:opacity .3s}
.cgp-idle .cgp-lamp.cgp-lamp-idle .cgp-lamp-dot,
.cgp-busy .cgp-lamp.cgp-lamp-busy .cgp-lamp-dot{filter:drop-shadow(0 0 4px currentColor)}
/* 模型解题中：激活状态灯一循环≈1.7s（亮≈0.6s、暗≈1.1s）；闲置时常亮不闪 */
.cgp-working.cgp-idle .cgp-lamp.cgp-lamp-idle .cgp-lamp-dot,
.cgp-working.cgp-busy .cgp-lamp.cgp-lamp-busy .cgp-lamp-dot,
.cgp-working .cgp-min-lamp,
.cgp-working .cgp-bar-lamp{animation:cgp-lamp-blink 1.7s linear infinite}
@keyframes cgp-lamp-blink{0%,35%{opacity:1}42%,100%{opacity:.15}}
.cgp-lamp-label{font-size:11px;color:var(--cgp-muted)}

/* ===== 极简数字 ===== */
.cgp-min-status{display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:4px}
.cgp-min-lamp{width:10px;height:10px;border-radius:50%;flex:none}
.cgp-min-lamp.idle{background:#22ac38;box-shadow:0 0 7px 2px rgba(34,172,56,.6)}
.cgp-min-lamp.busy{background:#fac000;box-shadow:0 0 7px 2px rgba(250,192,0,.6)}
.cgp-min-status-txt{font-weight:700}
.cgp-min-status-txt.idle{color:#4ade80}
.cgp-min-status-txt.busy{color:#fbbf24}
.cgp-min-count{margin-left:auto;color:var(--cgp-muted);font-size:11px}

/* ===== 环形仪表 ===== */
.cgp-ring-wrap{position:relative;width:170px;margin:0 auto}
.cgp-ring-wrap svg{display:block;width:100%;height:auto}
.cgp-rg-track{fill:none;stroke:var(--cgp-track);stroke-width:14}
.cgp-rg-red{fill:none;stroke:${COL.odoRed};stroke-width:14;stroke-linecap:round;filter:url(#cgp-glow-red)}
.cgp-rg-fuel{fill:none;stroke:url(#cgp-odo-grad);stroke-width:14;stroke-linecap:round;filter:url(#cgp-glow-green)}
.cgp-ring-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.cgp-ring-num{font-size:24px;font-weight:700;color:var(--cgp-fg);font-variant-numeric:tabular-nums}
.cgp-ring-label{font-size:11px;color:var(--cgp-muted);margin-top:2px}

/* ===== 迷你状态条 ===== */
.cgp-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:12px}
.cgp-bar-lamp{width:10px;height:10px;border-radius:50%;flex:none}
.cgp-bar-lamp.idle{background:#22ac38;box-shadow:0 0 7px 2px rgba(34,172,56,.6)}
.cgp-bar-lamp.busy{background:#fac000;box-shadow:0 0 7px 2px rgba(250,192,0,.6)}
.cgp-bar-item{white-space:nowrap}
.cgp-bar-item i{font-style:normal;color:var(--cgp-muted);margin-right:3px}
.cgp-bar-item b{color:var(--cgp-fg);font-variant-numeric:tabular-nums;font-weight:700}
/* 浅色主题：去掉所有阴影/投影（放在末尾，覆盖前面的元素规则） */
@media (prefers-color-scheme: light){
  .cgp-ring,.cgp-ring-arc,.cgp-pill{filter:none}
  .cgp-flapboard,.cgp-model-pill{box-shadow:none}
}
`

    let styleEl = null
    function injectCss() {
      if (typeof document === 'undefined') return
      if (document.querySelector('style[data-plugin-css="dsh-cost-gauge-plus"]')) return
      styleEl = document.createElement('style')
      styleEl.dataset.plugin = 'dsh-cost-gauge-plus'
      styleEl.dataset.pluginCss = 'dsh-cost-gauge-plus'
      styleEl.textContent = CSS
      document.head.appendChild(styleEl)
    }

    /* ---------- localStorage ---------- */
    function loadJSON(key) {
      try {
        const raw = localStorage.getItem(LS_PREFIX + ':' + key)
        if (raw) return JSON.parse(raw)
      } catch {}
      return null
    }
    function saveJSON(key, v) {
      try { localStorage.setItem(LS_PREFIX + ':' + key, JSON.stringify(v)) } catch {}
    }
    function loadLocalThreshold() {
      const raw = localStorage.getItem(LS_PREFIX + ':threshold')
      if (raw !== null) {
        const n = Number(raw)
        if (Number.isFinite(n) && n >= 0) return n
      }
      return null
    }
    function saveLocalThreshold(v) {
      try { localStorage.setItem(LS_PREFIX + ':threshold', String(v)) } catch {}
    }
    function loadMaxBalance() {
      const raw = localStorage.getItem(LS_PREFIX + ':maxBalance')
      const n = Number(raw)
      return Number.isFinite(n) && n > 0 ? n : null
    }
    function saveMaxBalance(v) {
      try { localStorage.setItem(LS_PREFIX + ':maxBalance', String(v)) } catch {}
    }

    /* ---------- 工具 ---------- */
    function fmtMoney(v) {
      if (v === undefined || v === null || !Number.isFinite(v)) return '—'
      return '¥' + (v >= 100 ? v.toFixed(0) : v.toFixed(2))
    }
    function fmtWhole(v) {
      if (v === undefined || v === null || !Number.isFinite(v)) return '—'
      return '¥' + Math.round(v)
    }
    function fmtCountdown(s) {
      if (!Number.isFinite(s) || s < 0) return ''
      const h = Math.floor(s / 3600)
      const m = Math.floor((s % 3600) / 60)
      if (h > 0) return `距离切换：${h}小时${m}分`
      if (m > 0) return `距离切换：${m}分${Math.floor(s % 60)}秒`
      return `距离切换：${Math.floor(s % 60)}秒`
    }
    function beijingClock(now = new Date()) {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Shanghai', hour12: false,
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }).formatToParts(now)
      const get = (t) => Number(parts.find((p) => p.type === t)?.value) || 0
      return { h: get('hour'), m: get('minute'), s: get('second') }
    }
    function handAngle12(c) { return ((c.h % 12) + c.m / 60 + c.s / 3600) * 30 }
    function polar(cx, cy, r, deg) {
      const a = (deg - 90) * Math.PI / 180
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
    }
    function arcPath(cx, cy, r, a0, a1) {
      const [x0, y0] = polar(cx, cy, r, a0)
      const [x1, y1] = polar(cx, cy, r, a1)
      const large = Math.abs(a1 - a0) > 180 ? 1 : 0
      const sweep = a1 > a0 ? 1 : 0
      return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(2)} ${y1.toFixed(2)}`
    }
    function svgEl(tag, attrs) {
      const el = document.createElementNS('http://www.w3.org/2000/svg', tag)
      for (const k in attrs) el.setAttribute(k, attrs[k])
      return el
    }
    function hitRateOf(tokens) {
      if (!tokens) return null
      const a = Number(tokens.uncachedInputTokens) || 0
      const b = Number(tokens.cacheReadTokens) || 0
      const den = a + b
      if (den <= 0) return null
      return Math.round((b / den) * 100)
    }
    function pricingLabel(pricingKey) {
      return pricingKey ? (pricingKey.charAt(0).toUpperCase() + pricingKey.slice(1)) : '—'
    }

    /* ================================================================
     * 皮肤
     * ================================================================ */
    const ODO_R = 72
    function odoAngle(f) { return 270 + f * 180 }
    function odoPath(r, f0, f1) { return arcPath(100, 100, r, odoAngle(f0), odoAngle(f1)) }

    function buildClockRing(ringEl, isWeekend, isPM, w, busyColor, idleColor) {
      ringEl.textContent = ''
      const mkCircle = (color) => {
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        c.setAttribute('cx', '100'); c.setAttribute('cy', '100'); c.setAttribute('r', '90')
        c.setAttribute('class', 'cgp-ring-base')
        c.style.stroke = color; c.style.strokeWidth = w + 'px'
        return c
      }
      const mkArc = (a0, a1, color) => {
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        p.setAttribute('d', arcPath(100, 100, 90, a0, a1))
        p.setAttribute('class', 'cgp-ring-arc')
        p.style.stroke = color; p.style.strokeWidth = w + 'px'
        return p
      }
      if (isWeekend) { ringEl.appendChild(mkCircle(idleColor)); return }
      ringEl.appendChild(mkCircle(busyColor))
      ringEl.appendChild(mkArc(345, 405, idleColor))
      if (isPM) ringEl.appendChild(mkArc(165, 345, idleColor))
      else ringEl.appendChild(mkArc(45, 255, idleColor))
    }

    function renderOdometer(odoEl, balance, threshold, maxBalance) {
      const scale = (Number.isFinite(balance) && balance > 0)
        ? ((Number.isFinite(maxBalance) && maxBalance > 0) ? maxBalance : balance) : 100
      const fbal = Math.min(1, Math.max(0, (balance || 0) / scale))
      const fthr = Math.min(1, Math.max(0, threshold / scale))
      odoEl.textContent = ''
      odoEl.appendChild(svgEl('path', { class: 'cgp-odo-track', d: odoPath(ODO_R, 0, 1) }))
      odoEl.appendChild(svgEl('path', { class: 'cgp-odo-fuel', d: odoPath(ODO_R, 0, Math.max(fbal, 0.02)) }))
      odoEl.appendChild(svgEl('path', { class: 'cgp-odo-red', d: odoPath(ODO_R, 0, Math.max(fthr, 0.02)) }))
      const na = odoAngle(fbal)
      const [nx, ny] = polar(100, 100, 56, na)
      odoEl.appendChild(svgEl('line', { class: 'cgp-odo-needle', x1: '100', y1: '100', x2: nx.toFixed(2), y2: ny.toFixed(2) }))
      const l0 = svgEl('text', { class: 'cgp-odo-label', x: '36', y: '101', 'text-anchor': 'start' })
      l0.textContent = '¥0'
      const l1 = svgEl('text', { class: 'cgp-odo-label', x: '164', y: '101', 'text-anchor': 'end' })
      l1.textContent = fmtMoney(scale)
      const thrPos = polar(100, 100, 50, odoAngle(fthr))
      const l2 = svgEl('text', { class: 'cgp-odo-label', x: thrPos[0].toFixed(1), y: thrPos[1].toFixed(1), 'text-anchor': 'middle' })
      l2.textContent = fmtWhole(threshold)
      odoEl.appendChild(l0); odoEl.appendChild(l1); odoEl.appendChild(l2)
      return { scale, fbal, fthr }
    }

    function renderHitPill(pillG, text) {
      pillG.textContent = ''
      const label = svgEl('text', { class: 'cgp-hit-label', x: '100', y: '147' })
      label.textContent = '缓存命中'
      const rect = svgEl('rect', { class: 'cgp-pill', x: '81', y: '152', width: '38', height: '18', rx: '9' })
      const t = svgEl('text', { class: 'cgp-pill-text', x: '100', y: '161' })
      t.textContent = text
      pillG.appendChild(label); pillG.appendChild(rect); pillG.appendChild(t)
    }

    function setFlapChar(cell, ch) {
      if (cell.dataset.ch === ch) return
      const old = cell.firstElementChild
      const nw = document.createElement('span')
      nw.className = 'cgp-flap-char'
      nw.textContent = ch
      cell.appendChild(nw)
      cell.dataset.ch = ch
      if (old) {
        old.classList.remove('cgp-flap-in')
        old.classList.add('cgp-flap-out')
        const rm = () => { if (old.isConnected) old.remove() }
        old.addEventListener('animationend', rm, { once: true })
        setTimeout(rm, 300) // 兜底：animationend 未触发时也清理
      }
      nw.classList.add('cgp-flap-in')
      const clr = () => nw.classList.remove('cgp-flap-in')
      nw.addEventListener('animationend', clr, { once: true })
      setTimeout(clr, 350)
      // 防御：清理任何残留的旧 span（最多保留 最新+正在翻出 两个）
      while (cell.children.length > 2) cell.firstElementChild.remove()
    }

    /** 星空皮肤：星点生命循环——亮起→停留→变暗消失→(概率)随机换个位置再出现。返回停止函数。 */
    function startStars(layer, isWeekend, isPM, count = 60) {
      layer.textContent = ''
      const ranges = isWeekend
        ? [[0, 360]]
        : (isPM ? [[345, 405], [165, 345]] : [[345, 405], [45, 255]])
      const colors = ['#ffffff', '#ffffff', '#ffffff', '#ffe27a', '#ffe27a', '#c39bff', '#ff7a7a']
      function randPos() {
        const r = ranges[Math.floor(Math.random() * ranges.length)]
        const a = r[0] + Math.random() * (r[1] - r[0])
        const rad = 85 + Math.random() * 10
        return polar(100, 100, rad, a)
      }
      const phases = ['fadeIn', 'hold', 'fadeOut', 'off']
      const stars = []
      for (let i = 0; i < count; i++) {
        const el = svgEl('circle', { class: 'cgp-star', r: (0.45 + Math.random() * 0.8).toFixed(2), fill: colors[Math.floor(Math.random() * colors.length)] })
        layer.appendChild(el)
        const s = {
          el,
          phase: phases[Math.floor(Math.random() * phases.length)],
          t: Math.random() * 3,
          fadeIn: 0.6 + Math.random() * 0.9,
          hold: 1.6 + Math.random() * 2.6,
          fadeOut: 0.5 + Math.random() * 0.8,
          off: 0.4 + Math.random() * 1.8,
          wob: 1.2 + Math.random() * 2.4,
          ph: Math.random() * Math.PI * 2,
          opacity: 0,
        }
        const [x, y] = randPos()
        el.setAttribute('cx', x.toFixed(1))
        el.setAttribute('cy', y.toFixed(1))
        el.setAttribute('opacity', '0')
        stars.push(s)
      }
      let raf = 0
      let last = performance.now()
      function step(now) {
        const dt = Math.min(0.1, (now - last) / 1000)
        last = now
        for (const s of stars) {
          s.t += dt
          if (s.phase === 'fadeIn') {
            s.opacity = Math.min(1, s.opacity + dt / s.fadeIn)
            if (s.opacity >= 1) { s.opacity = 1; s.phase = 'hold'; s.t = 0 }
          } else if (s.phase === 'hold') {
            s.opacity = 0.8 + 0.2 * Math.sin(s.t * s.wob + s.ph)
            if (s.t >= s.hold) { s.phase = 'fadeOut'; s.t = 0 }
          } else if (s.phase === 'fadeOut') {
            s.opacity = Math.max(0, s.opacity - dt / s.fadeOut)
            if (s.opacity <= 0) { s.opacity = 0; s.phase = 'off'; s.t = 0 }
          } else {
            if (s.t >= s.off) {
              if (Math.random() < 0.7) {
                const [x, y] = randPos()
                s.el.setAttribute('cx', x.toFixed(1))
                s.el.setAttribute('cy', y.toFixed(1))
                s.phase = 'fadeIn'
              }
              s.t = 0
            }
          }
          s.el.setAttribute('opacity', s.opacity.toFixed(3))
        }
        raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
      return () => cancelAnimationFrame(raf)
    }

    function buildLampSvg(color, lit, progressRes) {
      const C = 2 * Math.PI * 8
      const dash = lit ? (progressRes * C).toFixed(2) + ' ' + C.toFixed(2) : '0 ' + C.toFixed(2)
      const svg = svgEl('svg', { width: '22', height: '22', viewBox: '0 0 22 22' })
      svg.appendChild(svgEl('circle', { cx: '11', cy: '11', r: '9', fill: color, opacity: lit ? '0.28' : '0.12', class: 'cgp-lamp-base' }))
      const ring = svgEl('circle', { cx: '11', cy: '11', r: '8', fill: 'none', stroke: color, 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-dasharray': dash, transform: 'rotate(-90 11 11)', class: 'cgp-lamp-ring' })
      const dot = svgEl('circle', { cx: '11', cy: '11', r: '3.6', fill: color, class: 'cgp-lamp-dot' })
      dot.style.opacity = lit ? '1' : '0.5'
      dot.style.color = color
      svg.appendChild(ring); svg.appendChild(dot)
      return svg
    }

    function progressRes(rate) {
      if (rate && Number.isFinite(rate.nextSwitchAt) && Number.isFinite(rate.periodStart)) {
        const total = rate.nextSwitchAt - rate.periodStart
        const remaining = rate.nextSwitchAt - Date.now()
        if (total > 0) return Math.min(1, Math.max(0, remaining / total))
      }
      return 0.5
    }

    function classicSkin(opts = {}) {
      const id = opts.id || 'classic'
      const name = opts.name || '经典时钟'
      const stars = !!opts.stars
      const DEFS = `
<defs>
  <linearGradient id="cgp-odo-grad" gradientUnits="userSpaceOnUse" x1="28" y1="100" x2="172" y2="30">
    <stop offset="0%" stop-color="#f39800"/><stop offset="100%" stop-color="#40b25d"/>
  </linearGradient>
  <linearGradient id="cgp-star-grad" gradientUnits="userSpaceOnUse" x1="100" y1="0" x2="100" y2="200">
    <stop offset="0%" stop-color="#040a3a"/><stop offset="100%" stop-color="#00081e"/>
  </linearGradient>
  <filter id="cgp-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2.5" stdDeviation="3" flood-color="#000000" flood-opacity="0.45"/></filter>
  <filter id="cgp-glow-green" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#40b25d" flood-opacity="0.55"/></filter>
  <filter id="cgp-glow-red" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-color="#000000" flood-opacity="0.55"/><feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#c30d23" flood-opacity="0.6"/></filter>
  <filter id="cgp-glow-orange" x="-80%" y="-80%" width="260%" height="260%"><feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="#f39800" flood-opacity="0.75"/></filter>
  <filter id="cgp-glow-white" x="-80%" y="-80%" width="260%" height="260%"><feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="#ffffff" flood-opacity="0.4"/></filter>
  <filter id="cgp-stack-green" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-color="#000000" flood-opacity="0.45"/></filter>
</defs>`
      return {
        id, name, collapsible: true,
        build(el, st) {
          el.innerHTML = `
<div class="cgp-status-row">
  <span class="cgp-status">—</span><span class="cgp-countdown"></span>
</div>
<div class="cgp-clock">
  <svg viewBox="0 0 200 200" aria-label="费率时钟">${DEFS}
    <circle class="cgp-disc" cx="100" cy="100" r="97"></circle>
    <g class="cgp-ring"></g><g class="cgp-stars"></g><g class="cgp-odo"></g>
    <circle class="cgp-hub" cx="100" cy="100" r="3.6"></circle>
    <g class="cgp-hand"><line x1="100" y1="100" x2="100" y2="42"></line><circle cx="100" cy="100" r="3.6"></circle></g>
    <g class="cgp-hit-pill"></g>
  </svg>
  <div class="cgp-flapboard">
    <span class="cgp-flap-cell"></span><span class="cgp-flap-cell"></span><span class="cgp-flap-colon">:</span><span class="cgp-flap-cell"></span><span class="cgp-flap-cell"></span>
  </div>
</div>
<div class="cgp-bottom">
  <div class="cgp-rows">
    <div class="cgp-row"><span>话费花费</span><span class="cgp-val cgp-cost">—</span></div>
    <div class="cgp-row"><span>余额</span><span class="cgp-val cgp-balance">—</span></div>
  </div>
  <div class="cgp-model"><span class="cgp-model-pill cgp-model-text"><span class="cgp-model-measure"></span></span></div>
</div>
<div class="cgp-compact">
  <div class="cgp-row"><span>话费</span><span class="cgp-val cgp-cost2">—</span></div>
  <div class="cgp-lamps">
    <span class="cgp-lamp cgp-lamp-idle"><span class="cgp-lamp-svg-idle"></span><span class="cgp-lamp-label">空闲</span></span>
    <span class="cgp-lamp cgp-lamp-busy"><span class="cgp-lamp-svg-busy"></span><span class="cgp-lamp-label">繁忙</span></span>
  </div>
  <div class="cgp-row"><span>余额</span><span class="cgp-val cgp-balance2">—</span></div>
</div>`
          const ringEl = el.querySelector('.cgp-ring')
          const starLayer = el.querySelector('.cgp-stars')
          const odoEl = el.querySelector('.cgp-odo')
          const handEl = el.querySelector('.cgp-hand')
          const hitPillEl = el.querySelector('.cgp-hit-pill')
          const statusEl = el.querySelector('.cgp-status')
          const countdownEl = el.querySelector('.cgp-countdown')
          const costEl = el.querySelector('.cgp-cost')
          const costEl2 = el.querySelector('.cgp-cost2')
          const balanceEl = el.querySelector('.cgp-balance')
          const balanceEl2 = el.querySelector('.cgp-balance2')
          const modelEl = el.querySelector('.cgp-model-text')
          const modelMeasure = el.querySelector('.cgp-model-measure')
          const idlePh = el.querySelector('.cgp-lamp-svg-idle')
          const busyPh = el.querySelector('.cgp-lamp-svg-busy')
          // 双状态灯只构建一次（呼吸动画持续运行），之后仅更新进度环。
          idlePh.appendChild(buildLampSvg('#22ac38', false, 0))
          busyPh.appendChild(buildLampSvg('#fac000', false, 0))
          const flapCells = Array.from(el.querySelectorAll('.cgp-flap-cell'))
          let lastRingKey = null
          let lastData = null

          function setModelText(text) {
            if (modelEl.dataset.val === text) return
            modelMeasure.textContent = text
            const old = modelEl.querySelector('.cgp-model-inner')
            const nw = document.createElement('span')
            nw.className = 'cgp-model-inner' + (old ? ' cgp-model-in' : '')
            nw.textContent = text
            modelEl.appendChild(nw)
            modelEl.dataset.val = text
            if (old) {
              old.classList.remove('cgp-model-in')
              old.classList.add('cgp-model-out')
              const rm = () => { if (old.isConnected) old.remove() }
              old.addEventListener('animationend', rm, { once: true })
              setTimeout(rm, 300)
            }
            nw.classList.add('cgp-model-in')
            const clr = () => nw.classList.remove('cgp-model-in')
            nw.addEventListener('animationend', clr, { once: true })
            setTimeout(clr, 350)
            // 防御：只清理多余的翻牌层（不影响撑宽的 measure）
            while (modelEl.querySelectorAll('.cgp-model-inner').length > 2) {
              const e = modelEl.querySelector('.cgp-model-inner')
              if (e) e.remove()
            }
          }
          function renderRing() {
            const { w, busy, idle } = st.ringPrefs()
            const isPM = st.clock().h >= 12
            const dark = !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches)
            const key = `${st.isWeekend()}|${isPM}|${w}|${busy}|${idle}|${dark && stars}`
            if (key !== lastRingKey) {
              lastRingKey = key
              const idleC = (stars && dark) ? 'url(#cgp-star-grad)' : idle
              buildClockRing(ringEl, st.isWeekend(), isPM, w, busy, idleC)
              if (stopStars) { stopStars(); stopStars = null }
              if (stars && starLayer) {
                if (dark) stopStars = startStars(starLayer, st.isWeekend(), isPM)
                else starLayer.textContent = ''
              }
            }
          }
          function renderLamps(peak, rate) {
            // 灯只构建一次，这里仅更新进度环；灯芯动画持续运行不重启。
            const pr = progressRes(rate)
            const C = 2 * Math.PI * 8
            const idleRing = idlePh.querySelector('.cgp-lamp-ring')
            const busyRing = busyPh.querySelector('.cgp-lamp-ring')
            idleRing.setAttribute('stroke-dasharray', ((!peak ? pr : 0) * C).toFixed(2) + ' ' + C.toFixed(2))
            busyRing.setAttribute('stroke-dasharray', ((peak ? pr : 0) * C).toFixed(2) + ' ' + C.toFixed(2))
          }
          function updateFlap(c) {
            const hh = String(c.h).padStart(2, '0'), mm = String(c.m).padStart(2, '0')
            const chars = [hh[0], hh[1], mm[0], mm[1]]
            flapCells.forEach((cell, i) => setFlapChar(cell, chars[i]))
          }

          let mq = null
          let onTheme = null
          let stopStars = null
          if (stars) {
            mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null
            onTheme = () => { lastRingKey = null; if (lastData) skinApi.render(lastData) }
            if (mq && mq.addEventListener) mq.addEventListener('change', onTheme)
          }

          const skinApi = {
            render(data) {
              lastData = data
              const peak = !!(data.rate && data.rate.peak)
              el.classList.toggle('cgp-busy', peak)
              el.classList.toggle('cgp-idle', !peak)
              el.classList.toggle('cgp-working', st.isWorking())
              statusEl.className = 'cgp-status ' + (peak ? 'cgp-busy' : 'cgp-idle')
              statusEl.textContent = peak ? '繁忙（高峰）' : '空闲（标准）'
              const cost = data.cost
              const costText = cost && Number.isFinite(cost.cost) ? fmtMoney(cost.cost) : '—'
              costEl.textContent = costText; costEl2.textContent = costText
              const hr = hitRateOf(cost && cost.tokens)
              renderHitPill(hitPillEl, hr === null ? '--%' : hr + '%')
              setModelText(pricingLabel(cost && cost.pricingKey))
              const bal = data.balance
              if (bal && bal.total !== undefined && Number.isFinite(bal.total)) {
                const t = fmtMoney(bal.total)
                balanceEl.textContent = t; balanceEl2.textContent = t
                renderOdometer(odoEl, bal.total, st.threshold(), st.maxBalance())
              } else {
                balanceEl.textContent = '—'; balanceEl2.textContent = '—'
                renderOdometer(odoEl, 0, st.threshold(), st.maxBalance())
              }
              renderRing()
              renderLamps(peak, data.rate)
            },
            tick(c) {
              handEl.style.transform = 'rotate(' + handAngle12(c) + 'deg)'
              updateFlap(c)
              const rate = st.rate()
              if (rate && Number.isFinite(rate.nextSwitchAt)) {
                const s = Math.max(0, Math.round((rate.nextSwitchAt - Date.now()) / 1000))
                countdownEl.textContent = fmtCountdown(s)
              }
              if (rate) renderLamps(el.classList.contains('cgp-busy'), rate)
              renderRing()
            },
            destroy() {
              if (stopStars) { stopStars(); stopStars = null }
              if (stars && mq && mq.removeEventListener) mq.removeEventListener('change', onTheme)
            }
          }
          return skinApi
        }
      }
    }

    function minimalSkin() {
      return {
        id: 'minimal', name: '极简数字', collapsible: false,
        build(el, st) {
          el.innerHTML = `
<div class="cgp-min-status"><span class="cgp-min-lamp"></span><span class="cgp-min-status-txt">—</span><span class="cgp-min-count"></span></div>
<div class="cgp-rows">
  <div class="cgp-row"><span>话费</span><span class="cgp-val cgp-min-cost">—</span></div>
  <div class="cgp-row"><span>余额</span><span class="cgp-val cgp-min-bal">—</span></div>
  <div class="cgp-row"><span>命中率</span><span class="cgp-val cgp-min-hit">—</span></div>
  <div class="cgp-row"><span>模型</span><span class="cgp-val cgp-min-model">—</span></div>
</div>`
          const lamp = el.querySelector('.cgp-min-lamp')
          const stxt = el.querySelector('.cgp-min-status-txt')
          const cnt = el.querySelector('.cgp-min-count')
          const costEl = el.querySelector('.cgp-min-cost')
          const balEl = el.querySelector('.cgp-min-bal')
          const hitEl = el.querySelector('.cgp-min-hit')
          const modelEl = el.querySelector('.cgp-min-model')
          return {
            render(data) {
              const peak = !!(data.rate && data.rate.peak)
              el.classList.toggle('cgp-working', st.isWorking())
              lamp.className = 'cgp-min-lamp ' + (peak ? 'busy' : 'idle')
              stxt.className = 'cgp-min-status-txt ' + (peak ? 'busy' : 'idle')
              stxt.textContent = peak ? '繁忙（高峰）' : '空闲（标准）'
              const cost = data.cost
              costEl.textContent = cost && Number.isFinite(cost.cost) ? fmtMoney(cost.cost) : '—'
              const hr = hitRateOf(cost && cost.tokens)
              hitEl.textContent = hr === null ? '—' : hr + '%'
              modelEl.textContent = pricingLabel(cost && cost.pricingKey)
              const bal = data.balance
              balEl.textContent = bal && Number.isFinite(bal.total) ? fmtMoney(bal.total) : '—'
            },
            tick() {
              const rate = st.rate()
              cnt.textContent = (rate && Number.isFinite(rate.nextSwitchAt))
                ? fmtCountdown(Math.max(0, Math.round((rate.nextSwitchAt - Date.now()) / 1000))) : ''
            },
            destroy() {}
          }
        }
      }
    }

    function ringSkin() {
      return {
        id: 'ring', name: '环形仪表', collapsible: false,
        build(el, st) {
          el.innerHTML = `
<div class="cgp-ring-wrap">
  <svg viewBox="0 0 200 200">
    <defs>
      <linearGradient id="cgp-odo-grad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="200" y2="200">
        <stop offset="0%" stop-color="#f39800"/><stop offset="100%" stop-color="#40b25d"/>
      </linearGradient>
      <filter id="cgp-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.45"/></filter>
      <filter id="cgp-glow-green" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#40b25d" flood-opacity="0.55"/></filter>
      <filter id="cgp-glow-red" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#c30d23" flood-opacity="0.6"/></filter>
    </defs>
    <circle class="cgp-rg-track" cx="100" cy="100" r="82" transform="rotate(-90 100 100)"></circle>
    <circle class="cgp-rg-fuel" cx="100" cy="100" r="82" transform="rotate(-90 100 100)" stroke-dasharray="0 515.22"></circle>
    <circle class="cgp-rg-red" cx="100" cy="100" r="82" transform="rotate(-90 100 100)" stroke-dasharray="0 515.22"></circle>
  </svg>
  <div class="cgp-ring-center"><div class="cgp-ring-num">—</div><div class="cgp-ring-label">余额</div></div>
</div>
<div class="cgp-rows">
  <div class="cgp-row"><span>话费</span><span class="cgp-val cgp-rg-cost">—</span></div>
  <div class="cgp-row"><span>命中率</span><span class="cgp-val cgp-rg-hit">—</span></div>
  <div class="cgp-row"><span>模型</span><span class="cgp-val cgp-rg-model">—</span></div>
</div>`
          const C = 2 * Math.PI * 82
          const fuel = el.querySelector('.cgp-rg-fuel')
          const red = el.querySelector('.cgp-rg-red')
          const num = el.querySelector('.cgp-ring-num')
          const costEl = el.querySelector('.cgp-rg-cost')
          const hitEl = el.querySelector('.cgp-rg-hit')
          const modelEl = el.querySelector('.cgp-rg-model')
          function setArc(circle, f) {
            const fv = Math.max(0, Math.min(1, f))
            circle.setAttribute('stroke-dasharray', (fv * C).toFixed(2) + ' ' + C.toFixed(2))
            circle.setAttribute('stroke-dashoffset', '0')
          }
          return {
            render(data) {
              const bal = data.balance
              const total = bal && Number.isFinite(bal.total) ? bal.total : 0
              num.textContent = Number.isFinite(total) ? fmtMoney(total) : '—'
              const scale = (Number.isFinite(total) && total > 0) ? (st.maxBalance() || total) : 100
              const fbal = total / scale
              const fthr = st.threshold() / scale
              setArc(fuel, fbal)
              setArc(red, fthr)
              const cost = data.cost
              costEl.textContent = cost && Number.isFinite(cost.cost) ? fmtMoney(cost.cost) : '—'
              const hr = hitRateOf(cost && cost.tokens)
              hitEl.textContent = hr === null ? '—' : hr + '%'
              modelEl.textContent = pricingLabel(cost && cost.pricingKey)
            },
            tick() {},
            destroy() {}
          }
        }
      }
    }

    function barSkin() {
      return {
        id: 'bar', name: '迷你状态条', collapsible: false,
        build(el, st) {
          el.innerHTML = `
<div class="cgp-bar">
  <span class="cgp-bar-lamp"></span>
  <span class="cgp-bar-item"><i>模型</i><b class="cgp-bar-model">—</b></span>
  <span class="cgp-bar-item"><i>命中率</i><b class="cgp-bar-hit">—</b></span>
  <span class="cgp-bar-item"><i>话费</i><b class="cgp-bar-cost">—</b></span>
  <span class="cgp-bar-item"><i>余额</i><b class="cgp-bar-bal">—</b></span>
</div>`
          const lamp = el.querySelector('.cgp-bar-lamp')
          const modelEl = el.querySelector('.cgp-bar-model')
          const hitEl = el.querySelector('.cgp-bar-hit')
          const costEl = el.querySelector('.cgp-bar-cost')
          const balEl = el.querySelector('.cgp-bar-bal')
          return {
            render(data) {
              const peak = !!(data.rate && data.rate.peak)
              el.classList.toggle('cgp-working', st.isWorking())
              lamp.className = 'cgp-bar-lamp ' + (peak ? 'busy' : 'idle')
              const cost = data.cost
              costEl.textContent = cost && Number.isFinite(cost.cost) ? fmtMoney(cost.cost) : '—'
              const hr = hitRateOf(cost && cost.tokens)
              hitEl.textContent = hr === null ? '—' : hr + '%'
              modelEl.textContent = pricingLabel(cost && cost.pricingKey)
              const bal = data.balance
              balEl.textContent = bal && Number.isFinite(bal.total) ? fmtMoney(bal.total) : '—'
            },
            tick() {},
            destroy() {}
          }
        }
      }
    }

    const B11_CSS = `
.cgp-b11{width:100%;box-sizing:border-box;text-align:center;user-select:none}
.cgp-b11 svg{display:block;margin:0 auto;width:100%;max-width:330px;height:auto}
.cgp-b11 .arc-bg{fill:none;stroke:rgba(255,255,255,.12);stroke-width:11;stroke-linecap:round}
.cgp-b11 .arc-std{fill:none;stroke:#22c55e;stroke-width:11;stroke-linecap:round}
.cgp-b11 .arc-peak{fill:none;stroke:#f59e0b;stroke-width:11;stroke-linecap:round}
.cgp-b11 .bal-track{fill:none;stroke:rgba(255,255,255,.04);stroke-width:5;stroke-linecap:round}
.cgp-b11 .bal-fill{fill:none;stroke:url(#cgp-b11-grad);stroke-width:5;stroke-linecap:round;opacity:.5}
.cgp-b11.cgp-b11-alarm .bal-fill{stroke:#ef4444;opacity:.95}
.cgp-b11 .bal-mark{stroke:rgba(255,255,255,.7);stroke-width:1.5;stroke-linecap:round;opacity:.7}
.cgp-b11 .ticks line{stroke:rgba(255,255,255,.22);stroke-width:1;stroke-linecap:round}
.cgp-b11 .ticks line.maj{stroke:rgba(255,255,255,.6)}
.cgp-b11 .needle{transform-box:view-box;transform-origin:70px 70px;transition:transform .6s linear;filter:drop-shadow(1px 2px 3px rgba(0,0,0,.6))}
.cgp-b11 .needle .hand-bg{stroke:rgba(0,0,0,.45);stroke-width:5;stroke-linecap:round}
.cgp-b11 .needle .hand{stroke:var(--cgp-b11-color,#f9fafb);stroke-width:3;stroke-linecap:round}
.cgp-b11 .needle .tail-bg{stroke:rgba(0,0,0,.3);stroke-width:3.5;stroke-linecap:round}
.cgp-b11 .needle .tail{stroke:var(--cgp-b11-color,#f9fafb);stroke-width:1.6;stroke-linecap:round;stroke-opacity:.55}
.cgp-b11 .needle .cap-rim{fill:none;stroke:rgba(0,0,0,.5);stroke-width:1.2}
.cgp-b11 .needle .cap{fill:var(--cgp-b11-color,#f9fafb)}
.cgp-b11 .meta{display:flex;justify-content:center;gap:30px;margin-top:3px}
.cgp-b11 .meta .col{display:flex;flex-direction:column;align-items:center;gap:1px}
.cgp-b11 .meta .lab{color:#8b8f98;font-size:10px}
.cgp-b11 .meta .val{font-size:12px;font-weight:600;white-space:nowrap}
.cgp-b11 .meta .val.st{color:#4ade80}
.cgp-b11 .meta .val.pk{color:#fbbf24}
.cgp-b11 .meta .val.cd{color:#d1d5db;font-variant-numeric:tabular-nums}
.cgp-b11 .rows{border-top:1px solid rgba(255,255,255,.08);padding-top:6px;margin-top:5px}
.cgp-b11 .rows .row{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#9ca3af;padding:3px 0}
.cgp-b11 .rows .row b{color:#f3f4f6;font-variant-numeric:tabular-nums;font-weight:600}
`

    // 皮肤注入一次独立样式（避免与其它皮肤类名冲突）。
    let b11StyleInjected = false
    function b11EnsureCss() {
      if (b11StyleInjected || typeof document === 'undefined') return
      if (document.querySelector('style[data-plugin-css="dsh-cost-gauge-plus-b11"]')) { b11StyleInjected = true; return }
      const s = document.createElement('style')
      s.dataset.plugin = 'dsh-cost-gauge-plus'
      s.dataset.pluginCss = 'dsh-cost-gauge-plus-b11'
      s.textContent = B11_CSS
      document.head.appendChild(s)
      b11StyleInjected = true
    }

    /** 皮肤：Basic 1.1 —— 双同心环表盘（费率外环 + 余额内环 + 内刻度 + 细直针）。 */
    function basic11Skin() {
      const CENTER_X = 70
      const CENTER_Y = 70
      const RATE_R = 58
      const BAL_R = 47
      const BAL_LO = 42.5
      const BAL_HI = 51.5

      function xy(p, r) { const a = (180 - p) * Math.PI / 180; return [CENTER_X + r * Math.cos(a), CENTER_Y - r * Math.sin(a)] }
      function arcD(a, b, r) { const [x1, y1] = xy(a, r); const [x2, y2] = xy(b, r); return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}` }
      function bjParts() {
        const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(new Date())
        const g = (t) => Number(parts.find((p) => p.type === t)?.value) || 0
        const y = g('year'); const mo = g('month'); const d = g('day'); let h = g('hour'); if (h === 24) h = 0
        return { weekday: new Date(Date.UTC(y, mo - 1, d)).getUTCDay(), hour: h, minute: g('minute'), second: g('second') }
      }
      function dialPos(hf) { const t = ((hf % 24) + 24) % 24; if (t < 6) return 90 - 15 * t; if (t <= 18) return 15 * t - 90; return 15 * (t - 18) }
      function fmtRemain(s) { if (!Number.isFinite(s) || s < 0) return ''; const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const se = Math.floor(s % 60); if (h > 0) return `${h}小时${m}分`; if (m > 0) return `${m}分${se}秒`; return `${se}秒` }
      function modelColor(key) { const k = String(key || '').toLowerCase(); if (k.includes('pro')) return '#fcd34d'; if (k.includes('vision')) return '#e879f9'; return '#7dd3fc' }

      return {
        id: 'basic11', name: 'Basic 1.1', collapsible: false,
        build(el, st) {
          b11EnsureCss()
          let tickMarkup = ''
          for (let p = 0; p <= 180; p += 15) {
            const a = Math.PI * (180 - p) / 180
            const cls = p % 45 === 0 ? ' class="maj"' : ''
            tickMarkup += `<line${cls} x1="${(CENTER_X + 40.5 * Math.cos(a)).toFixed(1)}" y1="${(CENTER_Y - 40.5 * Math.sin(a)).toFixed(1)}" x2="${(CENTER_X + 36.5 * Math.cos(a)).toFixed(1)}" y2="${(CENTER_Y - 36.5 * Math.sin(a)).toFixed(1)}"/>`
          }
          el.innerHTML = `
<div class="cgp-b11">
  <svg width="140" height="90" viewBox="0 0 140 90">
    <defs><linearGradient id="cgp-b11-grad" gradientUnits="userSpaceOnUse" x1="23" y1="70" x2="117" y2="70"><stop offset="0" stop-color="#1e6fd9"></stop><stop offset="1" stop-color="#59d2fe"></stop></linearGradient></defs>
    <path class="bal-track"></path>
    <path class="bal-fill"></path>
    <line class="bal-mark" x1="70" y1="70" x2="70" y2="70"></line>
    <path class="arc-std"></path>
    <path class="arc-peak"></path>
    <g class="ticks">${tickMarkup}</g>
    <g class="needle" style="transform:rotate(-90deg)">
      <line class="hand-bg" x1="70" y1="70" x2="70" y2="14"></line>
      <line class="hand" x1="70" y1="70" x2="70" y2="14"></line>
      <line class="tail-bg" x1="70" y1="70" x2="70" y2="79"></line>
      <line class="tail" x1="70" y1="70" x2="70" y2="79"></line>
      <circle class="cap-rim" cx="70" cy="70" r="5.5"></circle>
      <circle class="cap" cx="70" cy="70" r="4"></circle>
    </g>
  </svg>
  <div class="meta">
    <div class="col"><span class="lab">当前费率</span><span class="val st">—</span></div>
    <div class="col"><span class="lab">距离切换</span><span class="val cd"></span></div>
  </div>
  <div class="rows">
    <div class="row"><span>会话花费</span><b class="cost">—</b></div>
    <div class="row"><span>余额</span><b class="bal">—</b></div>
  </div>
</div>`
          const $ = (s) => el.querySelector(s)
          const stdArc = $('.arc-std')
          const peakArc = $('.arc-peak')
          const track = $('.bal-track')
          const fill = $('.bal-fill')
          const mark = $('.bal-mark')
          const needle = $('.needle')
          const statusVal = $('.meta .val.st')
          const countdownVal = $('.meta .val.cd')
          const costVal = $('.rows .cost')
          const balVal = $('.rows .bal')
          const wrap = $('.cgp-b11')
          let lastDeg = -90
          let histMax = 0
          let lastBal = null

          function drawArcs(weekday, hour) {
            const wk = weekday === 0 || weekday === 6
            const day = hour >= 6 && hour < 18
            // 夜间(18:00–6:00)无高峰段 → 整弧绿色，避免夜里指针扫到白天的黄段。
            if (wk || !day) { stdArc.setAttribute('d', arcD(0, 180, RATE_R)); peakArc.setAttribute('d', ''); return }
            stdArc.setAttribute('d', arcD(0, 45, RATE_R) + arcD(90, 120, RATE_R))
            peakArc.setAttribute('d', arcD(45, 90, RATE_R) + arcD(120, 180, RATE_R))
          }
          function drawBalance(balance, threshold) {
            if (!Number.isFinite(balance) || balance < 0) { fill.setAttribute('d', ''); mark.style.display = 'none'; return }
            lastBal = balance
            if (balance > histMax) histMax = balance
            const denom = Math.max(histMax, 1e-9)
            track.setAttribute('d', arcD(0, 180, BAL_R))
            fill.setAttribute('d', arcD(0, Math.min(180, (balance / denom) * 180), BAL_R))
            const t = Number(threshold)
            if (Number.isFinite(t) && t > 0) {
              const pm = Math.min(180, Math.max(0, (t / denom) * 180))
              const [x1, y1] = xy(pm, BAL_LO); const [x2, y2] = xy(pm, BAL_HI)
              mark.setAttribute('x1', x1.toFixed(1)); mark.setAttribute('y1', y1.toFixed(1))
              mark.setAttribute('x2', x2.toFixed(1)); mark.setAttribute('y2', y2.toFixed(1))
              mark.style.display = ''
            } else { mark.style.display = 'none' }
          }
          function drawNeedle(p) {
            const deg = p - 90
            if (lastDeg > 60 && deg < -60) { needle.style.transition = 'none'; needle.style.transform = `rotate(${deg}deg)`; void needle.getBoundingClientRect(); needle.style.transition = 'transform .6s linear' } else { needle.style.transform = `rotate(${deg}deg)` }
            lastDeg = deg
          }

          return {
            render(data) {
              const parts = bjParts()
              drawArcs(parts.weekday, parts.hour)
              const peak = !!(data.rate && data.rate.peak)
              statusVal.className = 'val ' + (peak ? 'pk' : 'st')
              statusVal.textContent = peak ? '翻倍（高峰）' : '标准（空闲）'
              const cost = data.cost
              costVal.textContent = cost && Number.isFinite(cost.cost) ? fmtMoney(cost.cost) : '—'
              const thr = st.threshold()
              const bal = data.balance
              const balNum = (bal && Number.isFinite(bal.total)) ? bal.total : undefined
              balVal.textContent = balNum === undefined ? '—' : fmtMoney(balNum)
              // 满刻度沿用宿主记忆的历史最高余额；无记录则用当前余额（满环）。
              if (histMax <= 0 || (balNum !== undefined && balNum > histMax)) histMax = Math.max(histMax, balNum || 0)
              drawBalance(balNum, thr)
              const low = balNum !== undefined && balNum < thr
              wrap.classList.toggle('cgp-b11-alarm', !!low)
              wrap.classList.toggle('cgp-b11-working', st.isWorking())
              const key = (cost && cost.pricingKey) || ''
              wrap.style.setProperty('--cgp-b11-color', modelColor(key))
              const rate = data.rate
              if (rate && Number.isFinite(rate.nextSwitchAt)) countdownVal.textContent = fmtRemain(Math.max(0, Math.round((rate.nextSwitchAt - Date.now()) / 1000)))
              drawNeedle(dialPos(parts.hour + parts.minute / 60 + parts.second / 3600))
            },
            tick() {
              const parts = bjParts()
              drawArcs(parts.weekday, parts.hour)
              drawNeedle(dialPos(parts.hour + parts.minute / 60 + parts.second / 3600))
              const rate = st.rate()
              if (rate && Number.isFinite(rate.nextSwitchAt)) countdownVal.textContent = fmtRemain(Math.max(0, Math.round((rate.nextSwitchAt - Date.now()) / 1000)))
            },
            destroy() {}
          }
        },
      }
    }

    const SKINS = [
      classicSkin(),
      classicSkin({ id: 'test1', name: '测试1', stars: true }),
      minimalSkin(),
      ringSkin(),
      barSkin(),
      basic11Skin(),
    ]
    const SKIN_BY_ID = {}
    for (const s of SKINS) SKIN_BY_ID[s.id] = s

    /* ================================================================
     * apply：共用壳 + 数据轮询 + 皮肤挂载
     * ================================================================ */
    function apply(ctx) {
      ctx.effect(() => {
        injectCss()

        const root = document.createElement('div')
        root.className = 'cgp-root'
        root.innerHTML = `
<div class="cgp-title" data-drag>
  <span class="cgp-title-text">DeepSeek 花费</span>
  <span class="cgp-alarm-dot" title=""></span>
  <button class="cgp-toggle" type="button" title="缩小">−</button>
  <button class="cgp-gear" type="button" title="设置">⚙</button>
</div>
<div class="cgp-body"></div>
<div class="cgp-settings">
  <label>皮肤</label>
  <select class="cgp-skin"></select>
  <label style="margin-top:8px">余额报警阈值（人民币）</label>
  <input class="cgp-threshold" type="number" min="0" step="1" inputmode="decimal">
  <div class="cgp-classic-prefs" style="margin-top:8px">
    <div class="cgp-pref-row"><label>外圈粗细（px）</label><input class="cgp-ring-w" type="number" min="3" max="20" step="1"></div>
    <div class="cgp-pref-row"><label>繁忙颜色</label><input class="cgp-ring-busy cgp-color" type="color"></div>
    <div class="cgp-pref-row"><label>空闲颜色</label><input class="cgp-ring-idle cgp-color" type="color"></div>
  </div>
</div>
<div class="cgp-resizer" data-resize title="拖拽缩放"></div>
`
        document.body.appendChild(root)

        const titleEl = root.querySelector('.cgp-title')
        const alarmDotEl = root.querySelector('.cgp-alarm-dot')
        const toggleEl = root.querySelector('.cgp-toggle')
        const gearEl = root.querySelector('.cgp-gear')
        const bodyEl = root.querySelector('.cgp-body')
        const skinSelect = root.querySelector('.cgp-skin')
        const thresholdEl = root.querySelector('.cgp-threshold')
        const classicPrefsEl = root.querySelector('.cgp-classic-prefs')
        const ringWEl = root.querySelector('.cgp-ring-w')
        const ringBusyEl = root.querySelector('.cgp-ring-busy')
        const ringIdleEl = root.querySelector('.cgp-ring-idle')
        const resizerEl = root.querySelector('.cgp-resizer')

        for (const s of SKINS) {
          const o = document.createElement('option')
          o.value = s.id
          o.textContent = s.name
          skinSelect.appendChild(o)
        }

        const savedPos = loadJSON('pos')
        root.style.left = (savedPos && typeof savedPos.x === 'number' ? savedPos.x : 24) + 'px'
        root.style.top = (savedPos && typeof savedPos.y === 'number' ? savedPos.y : 96) + 'px'
        const savedSize = loadJSON('size')
        const sizeW = savedSize && typeof savedSize.width === 'number'
          ? Math.min(MAX_W, Math.max(MIN_W, savedSize.width)) : DEFAULT_W
        root.style.width = sizeW + 'px'

        let localThreshold = loadLocalThreshold()
        let maxBalance = loadMaxBalance()
        let lastData = null
        let lastRate = null
        let lastClock = beijingClock()
        let lastWeekend = null
        let working = false
        let skinId = loadJSON('skin') || 'classic'
        if (!SKIN_BY_ID[skinId]) skinId = 'classic'
        let collapsed = loadJSON('collapsed') === true
        let ringW = (() => { const n = Number(loadJSON('ringWidth')); return Number.isFinite(n) && n >= 3 && n <= 20 ? Math.round(n) : 10 })()
        let ringBusy = loadJSON('ringBusy') || COL.busyRing
        let ringIdle = loadJSON('ringIdle') || COL.idleRing
        let currentSkinEl = null

        ringWEl.value = String(ringW)
        ringBusyEl.value = ringBusy
        ringIdleEl.value = ringIdle
        skinSelect.value = skinId

        const st = {
          threshold: () => (localThreshold !== null ? localThreshold : (lastData && Number.isFinite(lastData.threshold) ? lastData.threshold : DEFAULT_THRESHOLD)),
          rate: () => lastRate,
          clock: () => lastClock,
          isWeekend: () => !!lastWeekend,
          isWorking: () => working,
          maxBalance: () => maxBalance,
          ringPrefs: () => ({ w: ringW, busy: ringBusy, idle: ringIdle }),
        }

        function mountSkin(id) {
          if (currentSkinEl) { try { currentSkinEl.destroy() } catch (e) {} }
          bodyEl.textContent = ''
          const sk = SKIN_BY_ID[id] || SKIN_BY_ID.classic
          skinId = sk.id
          skinSelect.value = sk.id
          toggleEl.style.display = sk.collapsible ? '' : 'none'
          resizerEl.style.display = (sk.id === 'classic') ? '' : 'none'
          classicPrefsEl.style.display = (sk.id === 'classic') ? '' : 'none'
          const isCollapsed = collapsed && sk.collapsible
          root.classList.toggle('cgp-collapsed', isCollapsed)
          root.style.width = isCollapsed ? '' : sizeW + 'px'
          currentSkinEl = sk.build(bodyEl, st)
          if (lastData) currentSkinEl.render(lastData, st)
          saveJSON('skin', sk.id)
        }

        function render(data) {
          lastData = data
          lastRate = data.rate || null
          working = data.running === true
          if (data.schedule) lastWeekend = !!data.schedule.isWeekend
          const thr = st.threshold()
          const bal = data.balance
          if (bal && bal.total !== undefined && Number.isFinite(bal.total)) {
            const low = bal.total < thr
            root.classList.toggle('cgp-alarm', low)
            if (maxBalance === null || bal.total > maxBalance) { maxBalance = bal.total; saveMaxBalance(maxBalance) }
            alarmDotEl.title = low
              ? `余额 ¥${bal.total.toFixed(2)} 低于阈值 ¥${thr}，报警中`
              : `余额 ¥${bal.total.toFixed(2)}（阈值 ¥${thr}）`
          } else {
            root.classList.remove('cgp-alarm')
            alarmDotEl.title = (bal && bal.error) ? bal.error : '余额未知'
          }
          thresholdEl.value = String(thr)
          if (currentSkinEl) currentSkinEl.render(data, st)
        }

        function tick() {
          lastClock = beijingClock()
          if (currentSkinEl && currentSkinEl.tick) currentSkinEl.tick(lastClock, st)
        }

        async function poll() {
          let sid
          try { sid = ctx.sessions.list.getSnapshot().current } catch {}
          const url = '/api/cost-gauge-plus/state' + (sid ? '?session=' + encodeURIComponent(sid) : '')
          try {
            const res = await fetch(url)
            if (!res.ok) throw new Error('HTTP ' + res.status)
            render(await res.json())
          } catch (e) {
            render({ balance: { error: (e && e.message) || String(e) }, rate: null, cost: null, schedule: null, threshold: DEFAULT_THRESHOLD })
          }
        }

        // 拖动
        let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0
        titleEl.addEventListener('pointerdown', (e) => {
          if (e.target.closest('button, .cgp-alarm-dot')) return
          dragging = true; sx = e.clientX; sy = e.clientY; ox = root.offsetLeft; oy = root.offsetTop
          try { titleEl.setPointerCapture(e.pointerId) } catch {}
          e.preventDefault()
        })
        titleEl.addEventListener('pointermove', (e) => {
          if (!dragging) return
          root.style.left = Math.max(0, ox + (e.clientX - sx)) + 'px'
          root.style.top = Math.max(0, oy + (e.clientY - sy)) + 'px'
        })
        const endDrag = () => { if (dragging) { dragging = false; saveJSON('pos', { x: root.offsetLeft, y: root.offsetTop }) } }
        titleEl.addEventListener('pointerup', endDrag)
        titleEl.addEventListener('pointercancel', endDrag)

        // 缩放（仅经典）
        let resizing = false, rx = 0, rw = 0
        resizerEl.addEventListener('pointerdown', (e) => {
          if (root.classList.contains('cgp-collapsed')) return
          resizing = true; rx = e.clientX; rw = root.offsetWidth
          try { resizerEl.setPointerCapture(e.pointerId) } catch {}
          e.preventDefault(); e.stopPropagation()
        })
        resizerEl.addEventListener('pointermove', (e) => {
          if (!resizing) return
          root.style.width = Math.min(MAX_W, Math.max(MIN_W, rw + (e.clientX - rx))) + 'px'
        })
        const endResize = () => { if (resizing) { resizing = false; saveJSON('size', { width: root.offsetWidth }) } }
        resizerEl.addEventListener('pointerup', endResize)
        resizerEl.addEventListener('pointercancel', endResize)

        gearEl.addEventListener('click', () => root.classList.toggle('cgp-settings-open'))
        toggleEl.addEventListener('click', () => {
          collapsed = !collapsed
          saveJSON('collapsed', collapsed)
          root.classList.toggle('cgp-collapsed', collapsed)
          root.style.width = collapsed ? '' : sizeW + 'px'
          toggleEl.textContent = collapsed ? '＋' : '−'
          toggleEl.title = collapsed ? '展开' : '缩小'
        })

        thresholdEl.addEventListener('change', () => {
          const n = Number(thresholdEl.value)
          if (Number.isFinite(n) && n >= 0) {
            localThreshold = n
            saveLocalThreshold(n)
            if (lastData) render(lastData)
          } else {
            thresholdEl.value = String(st.threshold())
          }
        })

        skinSelect.addEventListener('change', () => mountSkin(skinSelect.value))

        function applyRingPrefs() { if (lastData) render(lastData) }
        ringWEl.addEventListener('change', () => {
          const n = Number(ringWEl.value)
          if (Number.isFinite(n)) { ringW = Math.min(20, Math.max(3, Math.round(n))); ringWEl.value = String(ringW); saveJSON('ringWidth', ringW); applyRingPrefs() }
          else ringWEl.value = String(ringW)
        })
        ringBusyEl.addEventListener('input', () => { ringBusy = ringBusyEl.value || COL.busyRing; saveJSON('ringBusy', ringBusy); applyRingPrefs() })
        ringIdleEl.addEventListener('input', () => { ringIdle = ringIdleEl.value || COL.idleRing; saveJSON('ringIdle', ringIdle); applyRingPrefs() })

        mountSkin(skinId)
        poll()
        tick()
        const pollTimer = setInterval(poll, POLL_MS)
        const clockTimer = setInterval(tick, 1000)

        return () => {
          clearInterval(pollTimer)
          clearInterval(clockTimer)
          root.remove()
        }
      }, 'dsh-cost-gauge-plus: widget')
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
