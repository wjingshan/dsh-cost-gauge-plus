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

/* ===== 共享标题栏「记录 / 归零」纯图标按钮（悬停有 title 提示） ===== */
.cgp-actbtn{flex:none;width:18px;height:18px;display:flex;align-items:center;justify-content:center;
  font-size:11px;line-height:1;padding:0;border-radius:5px;cursor:pointer;font-family:inherit;
  background:transparent;border:none;color:var(--cgp-muted)}
.cgp-actbtn:hover{background:var(--cgp-input-bg);color:var(--cgp-fg)}
.cgp-act-zero{color:#fcd34d}
.cgp-act-zero:hover{background:rgba(252,211,77,.16);color:#fde68a}
.cgp-act-zero.cgp-confirming{width:auto;min-width:18px;padding:0 5px;font-size:10px;
  background:rgba(239,68,68,.22);color:#fecaca}
.cgp-root.cgp-collapsed .cgp-actbtn{display:none}

/* ===== 记录面板（挂在窗口根节点，不属于任何皮肤；可拖动并钳制在窗口内） ===== */
.cgp-rec-panel{display:none;position:fixed;left:0;top:0;z-index:2147483000;
  width:580px;max-width:min(580px,92vw);max-height:calc(100vh - 16px);overflow:auto;
  box-sizing:border-box;background:var(--cgp-bg);color:var(--cgp-fg);
  border:1px solid var(--cgp-border);border-radius:12px;box-shadow:0 18px 44px rgba(0,0,0,.6);
  padding:10px 12px 12px;text-align:left;cursor:default}
.cgp-root.cgp-rec-open .cgp-rec-panel{display:block}
.cgp-root.cgp-collapsed .cgp-rec-panel{display:none}
.cgp-rec-head{display:flex;align-items:center;gap:8px;padding-bottom:7px;margin-bottom:8px;
  border-bottom:1px solid var(--cgp-border);cursor:grab}
.cgp-rec-head:active{cursor:grabbing}
.cgp-rec-title{font-size:12px;color:var(--cgp-fg);font-weight:600;flex:1;min-width:0;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cgp-rec-total{font-size:12px;color:#7dd3fc;font-weight:700;font-variant-numeric:tabular-nums}
.cgp-rec-close{border:none;background:transparent;color:var(--cgp-muted);cursor:pointer;font-size:13px;
  line-height:1;padding:2px 4px;border-radius:6px;font-family:inherit}
.cgp-rec-close:hover{color:var(--cgp-fg);background:var(--cgp-input-bg)}
.cgp-recbar{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}
.cgp-seg{display:flex;background:var(--cgp-input-bg);border:1px solid var(--cgp-border);
  border-radius:8px;padding:2px}
.cgp-seg button{border:none;background:transparent;color:var(--cgp-muted);font-size:11px;cursor:pointer;
  padding:4px 9px;border-radius:6px;font-family:inherit;white-space:nowrap}
.cgp-seg button.cgp-active{background:rgba(96,165,250,.22);color:#dbeafe;font-weight:600}
.cgp-nav{display:flex;align-items:center;gap:4px}
.cgp-nav button{border:1px solid var(--cgp-border);background:var(--cgp-input-bg);
  color:var(--cgp-fg);font-size:11px;line-height:1;padding:4px 7px;border-radius:7px;cursor:pointer;
  font-family:inherit}
.cgp-nav button:hover:not([disabled]){background:var(--cgp-border)}
.cgp-nav button[disabled]{opacity:.35;cursor:not-allowed}
.cgp-range-label{font-size:11px;color:var(--cgp-fg);font-weight:600;font-variant-numeric:tabular-nums}
.cgp-panel-actions{margin-left:auto;display:flex;align-items:center;gap:6px}
.cgp-export,.cgp-open{display:flex;align-items:center;gap:5px;font-size:11px;cursor:pointer;
  padding:5px 9px;border-radius:8px;font-family:inherit;white-space:nowrap}
.cgp-export{border:1px solid rgba(34,197,94,.45);background:rgba(34,197,94,.14);color:#bbf7d0}
.cgp-export:hover{background:rgba(34,197,94,.24);color:#dcfce7}
.cgp-open{border:1px solid rgba(96,165,250,.45);background:rgba(96,165,250,.14);color:#bfdbfe}
.cgp-open:hover{background:rgba(96,165,250,.24);color:#dbeafe}
.cgp-export[disabled],.cgp-open[disabled]{opacity:.42;cursor:not-allowed;
  border-color:var(--cgp-border);background:var(--cgp-input-bg);color:var(--cgp-muted)}
.cgp-chart{position:relative;margin:2px 0 8px;padding:14px 4px 0;background:var(--cgp-input-bg);
  border:1px solid var(--cgp-border);border-radius:10px}
.cgp-chart-max{position:absolute;left:8px;top:3px;font-size:9px;color:var(--cgp-muted);
  font-variant-numeric:tabular-nums}
.cgp-bars{display:flex;align-items:flex-end;gap:2px;height:104px}
.cgp-chart-bar{flex:1;min-width:0;height:100%;display:flex;flex-direction:column;justify-content:flex-end}
.cgp-chart-stack{display:flex;flex-direction:column;justify-content:flex-end;height:100%;
  border-radius:3px 3px 0 0;overflow:hidden;background:rgba(127,127,127,.10)}
.cgp-chart-seg{width:100%}
.cgp-chart-label{height:12px;line-height:12px;font-size:8px;color:var(--cgp-muted);text-align:center;
  margin-top:2px;overflow:hidden;white-space:nowrap}
.cgp-chart-bar:hover .cgp-chart-stack{outline:1px solid var(--cgp-border)}
.cgp-legend{display:flex;align-items:center;gap:10px;margin-top:6px;padding:0 8px 7px;
  font-size:10px;color:var(--cgp-muted);flex-wrap:wrap}
.cgp-legend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px;
  vertical-align:middle}
.cgp-tablewrap{max-height:186px;overflow:auto;border-top:1px solid var(--cgp-border);padding-top:4px}
.cgp-table{width:100%;border-collapse:collapse;font-size:11px;font-variant-numeric:tabular-nums}
.cgp-table th{position:sticky;top:0;background:var(--cgp-bg);color:var(--cgp-muted);font-weight:500;
  text-align:right;padding:3px 4px;border-bottom:1px solid var(--cgp-border);white-space:nowrap}
.cgp-table th:first-child{text-align:left}
.cgp-table td{color:var(--cgp-fg);padding:4px;text-align:right;border-bottom:1px solid var(--cgp-border)}
.cgp-table td:first-child{text-align:left;color:var(--cgp-muted)}
.cgp-table tr.cgp-sum td{color:var(--cgp-fg);font-weight:600;border-bottom:none;
  border-top:1px solid var(--cgp-border);position:sticky;bottom:0;background:var(--cgp-bg)}
.cgp-table .cgp-cell-std{color:#4ade80}
.cgp-table .cgp-cell-peak{color:#fbbf24}
.cgp-rec-foot{margin-top:8px;padding-top:7px;border-top:1px solid var(--cgp-border);
  font-size:10px;color:var(--cgp-muted);line-height:1.6}
.cgp-rec-empty{padding:14px 4px;font-size:11px;color:var(--cgp-muted);text-align:center}

/* ===== 设置：Excel 默认保存位置 ===== */
.cgp-pathrow{display:flex;align-items:center;gap:5px;margin-top:0}
.cgp-path{flex:1;min-width:0;font-size:10px;line-height:1.4;color:var(--cgp-fg);
  background:var(--cgp-input-bg);border:1px solid var(--cgp-border);border-radius:7px;
  padding:5px 7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cgp-path.cgp-unset{color:var(--cgp-muted)}
.cgp-mini-btn{flex:none;border:1px solid var(--cgp-border);background:var(--cgp-input-bg);
  color:var(--cgp-fg);font-size:11px;line-height:1;padding:5px 7px;border-radius:7px;cursor:pointer;
  font-family:inherit}
.cgp-mini-btn:hover{background:var(--cgp-border)}

/* ===== 面板提示条（toast） ===== */
.cgp-toast{position:absolute;left:50%;bottom:8px;transform:translateX(-50%) translateY(6px);
  z-index:2147483000;opacity:0;pointer-events:none;transition:opacity .25s,transform .25s;
  background:rgba(34,197,94,.16);border:1px solid rgba(34,197,94,.5);color:#bbf7d0;
  font-size:11px;line-height:1.3;padding:5px 9px;border-radius:10px;max-width:88%;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cgp-root.cgp-toast-show .cgp-toast{opacity:1;transform:translateX(-50%) translateY(0)}

/* ===== very narrow viewport: vertical minimized bar (ResizeObserver + hysteresis) =====
   Takes priority over expanded/collapsed: only the 48px vertical bar stays visible. */
.cgp-root.cgp-narrow{width:36px!important;padding:7px 5px;cursor:pointer;
  display:flex;flex-direction:column;align-items:center}
.cgp-root.cgp-narrow .cgp-title,
.cgp-root.cgp-narrow .cgp-body,
.cgp-root.cgp-narrow .cgp-settings,
.cgp-root.cgp-narrow .cgp-resizer,
.cgp-root.cgp-narrow .cgp-rec-panel,
.cgp-root.cgp-narrow .cgp-toast{display:none!important}
.cgp-narrowbar{display:none;flex-direction:column;align-items:center;gap:7px;width:100%}
.cgp-root.cgp-narrow .cgp-narrowbar{display:flex}
.cgp-narrow-lamp{width:12px;height:12px;border-radius:50%;flex:none;background:#22c55e;
  box-shadow:0 0 7px 2px rgba(34,197,94,.55);transition:background .4s,box-shadow .4s}
.cgp-narrowbar.cgp-narrow-peak .cgp-narrow-lamp{background:#fac000;box-shadow:0 0 7px 2px rgba(250,192,0,.6)}
.cgp-narrowbar.cgp-narrow-working .cgp-narrow-lamp{animation:cgp-lamp-blink 1.7s linear infinite}
.cgp-root.cgp-alarm .cgp-narrow-lamp{background:#ef4444;animation:cgp-blink 1s ease-in-out infinite}
.cgp-narrow-cost{color:var(--cgp-fg);font-size:11px;font-weight:700;font-variant-numeric:tabular-nums;
  writing-mode:vertical-rl;text-orientation:mixed;letter-spacing:.4px;max-height:96px;overflow:hidden}
.cgp-narrow-bal{color:var(--cgp-muted);font-size:10px;font-variant-numeric:tabular-nums;
  writing-mode:vertical-rl;text-orientation:mixed;letter-spacing:.4px;max-height:96px;overflow:hidden}
.cgp-narrow-badge{font-size:9px!important;padding:.3em .4em!important;
  writing-mode:vertical-rl;text-orientation:mixed;letter-spacing:.2px!important;max-height:80px;overflow:hidden}

/* 浅色主题：去掉所有阴影/投影（放在末尾，覆盖前面的元素规则） */
@media (prefers-color-scheme: light){
  .cgp-ring,.cgp-ring-arc,.cgp-pill{filter:none}
  .cgp-flapboard,.cgp-model-pill{box-shadow:none}
}
`

    // ===== 中英双语字典（键集合 zh / en 必须完全一致）=====
    const I18N = {
      zh: {
        // 标题栏 / 共享壳
        appTitle: 'DeepSeek 花费',
        balanceLight: '余额预警灯',
        minimize: '缩小',
        gearTitle: '设置',
        viewRecords: '查看本会话每日花费记录',
        resetCostHint: '会话花费归零，从此刻起重新累计',
        expandTip: '点击展开',
        resizeTip: '拖拽缩放',
        narrowTip: '窗口较窄：已切为竖版最小化，点击展开',
        // 设置区
        skinLabel: '皮肤',
        ringWidthLabel: '外圈粗细（px）',
        busyColorLabel: '繁忙颜色',
        idleColorLabel: '空闲颜色',
        thresholdLabel: '余额报警阈值（人民币）',
        excelFolderLabel: 'Excel 默认保存位置',
        pathUnset: '未设置 — 导出时弹窗选择',
        pickFolderTitle: '选择默认保存文件夹',
        select: '选择',
        clearPathTitle: '清除默认保存位置',
        // 各皮肤共用文案
        costSpend: '话费花费',
        costShort: '话费',
        sessionCost: '会话花费',
        balance: '余额',
        hitRate: '命中率',
        modelLabel: '模型',
        statusIdle: '空闲（标准）',
        statusBusy: '繁忙（高峰）',
        statusStd: '标准（空闲）',
        statusPeak: '翻倍（高峰）',
        lampIdle: '空闲',
        lampBusy: '繁忙',
        cacheHit: '缓存命中',
        ariaRateClock: '费率时钟',
        currentRate: '当前费率',
        nextSwitch: '距离切换',
        cdHM: '距离切换：{h}小时{m}分',
        cdMS: '距离切换：{m}分{s}秒',
        cdS: '距离切换：{s}秒',
        remainHM: '{h}小时{m}分',
        remainMS: '{m}分{s}秒',
        remainS: '{s}秒',
        countdownHM: '距切换 {h}小时{m}分',
        countdownMS: '距切换 {m}分{s}秒',
        countdownS: '距切换 {s}秒',
        // 皮肤名
        skinClassic: '经典时钟',
        skinTest1: '测试1',
        skinMinimal: '极简数字',
        skinRing: '环形仪表',
        skinBar: '迷你状态条',
        skinBasic11: 'Basic 1.1',
        // 余额灯 / 模型徽标提示
        balanceLowTitle: '余额 ¥{bal} 低于阈值 ¥{t}，报警中',
        balanceOkTitle: '余额 ¥{bal}（阈值 ¥{t}）',
        balanceQueryFailed: '查询失败',
        balanceUnknown: '余额未知',
        currentModel: '当前模型：{model}',
        noSessionModel: '暂无会话模型',
        // 记录面板
        sessionRecordsTitle: '本会话 · 花费记录',
        allRecordsTitle: '全部会话 · 花费记录',
        spendRecords: '花费记录',
        sessionFallback: '会话',
        sessionCountSuffix: '（{n} 个会话）',
        sessionCountShort: '（{n} 个）',
        lastResetSuffix: '（上次归零 {t}）',
        close: '关闭',
        rangeAll: '总时间',
        rangeYear: '年',
        rangeMonth: '月',
        rangeWeek: '周',
        rangeYearText: '{year} 年',
        monthLabel: '{m}月',
        wdMon: '周一',
        wdTue: '周二',
        wdWed: '周三',
        wdThu: '周四',
        wdFri: '周五',
        wdSat: '周六',
        wdSun: '周日',
        prevPeriod: '上一个时段',
        nextPeriod: '下一个时段',
        scopeSessionTitle: '只统计当前会话',
        scopeAllTitle: '合并统计所有会话',
        thisSession: '本会话',
        allSessions: '全部会话',
        byBand: '峰谷拆分',
        byModel: '模型拆分',
        exportTip: '导出 Excel（2 个工作表：按峰谷拆分 / 按模型拆分）',
        exportBtn: '⬇ 导出',
        openBtn: '📂 打开',
        openTip: '导出后可用：打开文件所在文件夹',
        totalWithValue: '合计 {v}',
        maxWithValue: '最大 {v}',
        period: '时段',
        offPeak: '空闲（标准）',
        peak: '高峰（翻倍）',
        total: '合计',
        noRecords: '暂无使用记录',
        panelNote: '按北京时间按日聚合（回放会话日志，含完整历史）；导出文件含 2 个工作表：<b>按峰谷拆分</b>、<b>按模型拆分</b>。',
        // 导出说明行
        exportNoteSession: '会话：',
        exportNoteBilling: '计费时间段：',
        exportNoteRange: '时间筛选：',
        exportNoteLastReset: '上次归零：',
        none: '无',
        exportNoteExportedAt: '导出时间：',
        unknownError: '未知错误',
        // 提示条（toast）
        toastExported: '已导出：{path}',
        toastExportCancelled: '已取消选择保存位置',
        toastExportFailed: '导出失败：{msg}',
        toastRevealed: '已在资源管理器中定位：{path}',
        toastOpenFailed: '打开失败：{msg}',
        toastDefaultSet: '已设为默认保存位置：{path}',
        toastPickCancelled: '已取消选择',
        toastSettingFailed: '设置失败：{msg}',
        toastCleared: '已清除默认保存位置',
        toastClearFailed: '清除失败',
        toastNoSession: '暂无会话可归零',
        toastResetDone: '已归零 · 会话花费重新累计',
        toastResetFailed: '归零失败：{msg}',
        confirm: '确认？',
        confirmResetTip: '再点一次确认归零',
      },
      en: {
        // Title bar / shared shell
        appTitle: 'DeepSeek Cost',
        balanceLight: 'Balance alert light',
        minimize: 'Minimize',
        gearTitle: 'Settings',
        viewRecords: "View this session's daily spend",
        resetCostHint: 'Reset session cost and start counting from now',
        expandTip: 'Click to expand',
        resizeTip: 'Drag to resize',
        narrowTip: 'Narrow window: compact mode, click to expand',
        // Settings
        skinLabel: 'Skin',
        ringWidthLabel: 'Outer ring width (px)',
        busyColorLabel: 'Busy color',
        idleColorLabel: 'Idle color',
        thresholdLabel: 'Balance alert threshold (CNY)',
        excelFolderLabel: 'Default Excel folder',
        pathUnset: 'Not set — pick a folder on export',
        pickFolderTitle: 'Choose the default save folder',
        select: 'Select',
        clearPathTitle: 'Clear the default save location',
        // Shared skin labels
        costSpend: 'Session cost',
        costShort: 'Cost',
        sessionCost: 'Session cost',
        balance: 'Balance',
        hitRate: 'Cache hit rate',
        modelLabel: 'Model',
        statusIdle: 'Idle (off-peak)',
        statusBusy: 'Busy (peak)',
        statusStd: 'Standard (off-peak)',
        statusPeak: 'Double (peak)',
        lampIdle: 'Idle',
        lampBusy: 'Busy',
        cacheHit: 'Cache hit',
        ariaRateClock: 'Rate clock',
        currentRate: 'Current rate',
        nextSwitch: 'Next switch',
        cdHM: '{h}h {m}m to switch',
        cdMS: '{m}m {s}s to switch',
        cdS: '{s}s to switch',
        remainHM: '{h}h {m}m',
        remainMS: '{m}m {s}s',
        remainS: '{s}s',
        countdownHM: 'in {h}h {m}m',
        countdownMS: 'in {m}m {s}s',
        countdownS: 'in {s}s',
        // Skin names
        skinClassic: 'Classic clock',
        skinTest1: 'Test 1',
        skinMinimal: 'Minimal',
        skinRing: 'Ring gauge',
        skinBar: 'Mini bar',
        skinBasic11: 'Basic 1.1',
        // Balance lamp / model badge titles
        balanceLowTitle: 'Balance ¥{bal} is below the threshold ¥{t} — alerting',
        balanceOkTitle: 'Balance ¥{bal} (threshold ¥{t})',
        balanceQueryFailed: 'Query failed',
        balanceUnknown: 'Balance unknown',
        currentModel: 'Current model: {model}',
        noSessionModel: 'No session model',
        // Records panel
        sessionRecordsTitle: 'This session · Spend records',
        allRecordsTitle: 'All sessions · Spend records',
        spendRecords: 'Spend records',
        sessionFallback: 'Session',
        sessionCountSuffix: ' ({n} sessions)',
        sessionCountShort: ' ({n})',
        lastResetSuffix: ' (last reset {t})',
        close: 'Close',
        rangeAll: 'All time',
        rangeYear: 'Year',
        rangeMonth: 'Month',
        rangeWeek: 'Week',
        rangeYearText: 'Year {year}',
        monthLabel: '{m}',
        wdMon: 'Mon',
        wdTue: 'Tue',
        wdWed: 'Wed',
        wdThu: 'Thu',
        wdFri: 'Fri',
        wdSat: 'Sat',
        wdSun: 'Sun',
        prevPeriod: 'Previous period',
        nextPeriod: 'Next period',
        scopeSessionTitle: 'Count this session only',
        scopeAllTitle: 'Combine all sessions',
        thisSession: 'This session',
        allSessions: 'All sessions',
        byBand: 'By peak/off-peak',
        byModel: 'By model',
        exportTip: 'Export Excel (2 sheets: by peak/off-peak / by model)',
        exportBtn: '⬇ Export',
        openBtn: '📂 Open',
        openTip: 'Available after export: open the containing folder',
        totalWithValue: 'Total {v}',
        maxWithValue: 'Max {v}',
        period: 'Period',
        offPeak: 'Off-peak (standard)',
        peak: 'Peak (double)',
        total: 'Total',
        noRecords: 'No usage records',
        panelNote: 'Aggregated by day in Beijing time (replayed from the session log, full history); the exported file contains 2 sheets: <b>By peak/off-peak</b> and <b>By model</b>.',
        // Export note line
        exportNoteSession: 'Session: ',
        exportNoteBilling: 'Billing period: ',
        exportNoteRange: 'Range: ',
        exportNoteLastReset: 'Last reset: ',
        none: 'none',
        exportNoteExportedAt: 'Exported at: ',
        unknownError: 'unknown error',
        // Toasts
        toastExported: 'Exported: {path}',
        toastExportCancelled: 'Folder selection cancelled',
        toastExportFailed: 'Export failed: {msg}',
        toastRevealed: 'Revealed in Explorer: {path}',
        toastOpenFailed: 'Open failed: {msg}',
        toastDefaultSet: 'Default save location set: {path}',
        toastPickCancelled: 'Selection cancelled',
        toastSettingFailed: 'Failed to save setting: {msg}',
        toastCleared: 'Default save location cleared',
        toastClearFailed: 'Failed to clear',
        toastNoSession: 'No session to reset',
        toastResetDone: 'Session cost reset · counting from now',
        toastResetFailed: 'Reset failed: {msg}',
        confirm: 'Confirm?',
        confirmResetTip: 'Click again to confirm reset',
      },
    }

    /** 当前语言：挂载时由 detectLocale(ctx) 决定，挂载后固定（不做运行时热切换）。 */
    let locale = 'en'
    /** 当前语言字典。 */
    let L = I18N[locale]

    /** 取词：用 {name} 占位符替换；缺 key 时原样返回 key。 */
    function t(key, params) {
      const s = Object.prototype.hasOwnProperty.call(L, key) ? L[key] : key
      if (!params) return s
      let out = String(s)
      for (const k in params) {
        if (!Object.prototype.hasOwnProperty.call(params, k)) continue
        out = out.split('{' + k + '}').join(String(params[k]))
      }
      return out
    }

    /** 日期时间本地化标签（均为 24 小时制）。 */
    function localeTag() {
      return locale === 'zh' ? 'zh-CN' : 'en-US'
    }

    /** 语言检测：优先 DSH 客户端 locale 服务，取不到时用系统/浏览器语言。 */
    function detectLocale(ctx) {
      try {
        const loc = ctx.get && ctx.get('locale')
        const snap = loc && typeof loc.getSnapshot === 'function' ? loc.getSnapshot() : null
        const active = snap && snap.active
        if (typeof active === 'string' && active) return /^zh/i.test(active) ? 'zh' : 'en'
      } catch {}
      try {
        const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'en'
        return /^zh/i.test(String(nav)) ? 'zh' : 'en'
      } catch {}
      return 'en'
    }

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
      if (h > 0) return t('cdHM', { h, m })
      if (m > 0) return t('cdMS', { m, s: Math.floor(s % 60) })
      return t('cdS', { s: Math.floor(s % 60) })
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
      label.textContent = t('cacheHit')
      const rect = svgEl('rect', { class: 'cgp-pill', x: '81', y: '152', width: '38', height: '18', rx: '9' })
      const valText = svgEl('text', { class: 'cgp-pill-text', x: '100', y: '161' })
      valText.textContent = text
      pillG.appendChild(label); pillG.appendChild(rect); pillG.appendChild(valText)
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
      const nameKey = opts.nameKey || 'skinClassic'
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
        id, nameKey, collapsible: true,
        build(el, st) {
          el.innerHTML = `
<div class="cgp-status-row">
  <span class="cgp-status">—</span><span class="cgp-countdown"></span>
</div>
<div class="cgp-clock">
  <svg viewBox="0 0 200 200" aria-label="${t('ariaRateClock')}">${DEFS}
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
    <div class="cgp-row"><span>${t('costSpend')}</span><span class="cgp-val cgp-cost">—</span></div>
    <div class="cgp-row"><span>${t('balance')}</span><span class="cgp-val cgp-balance">—</span></div>
  </div>
  <div class="cgp-model"><span class="cgp-model-pill cgp-model-text"><span class="cgp-model-measure"></span></span></div>
</div>
<div class="cgp-compact">
  <div class="cgp-row"><span>${t('costShort')}</span><span class="cgp-val cgp-cost2">—</span></div>
  <div class="cgp-lamps">
    <span class="cgp-lamp cgp-lamp-idle"><span class="cgp-lamp-svg-idle"></span><span class="cgp-lamp-label">${t('lampIdle')}</span></span>
    <span class="cgp-lamp cgp-lamp-busy"><span class="cgp-lamp-svg-busy"></span><span class="cgp-lamp-label">${t('lampBusy')}</span></span>
  </div>
  <div class="cgp-row"><span>${t('balance')}</span><span class="cgp-val cgp-balance2">—</span></div>
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
              statusEl.textContent = peak ? t('statusBusy') : t('statusIdle')
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
        id: 'minimal', nameKey: 'skinMinimal', collapsible: false,
        build(el, st) {
          el.innerHTML = `
<div class="cgp-min-status"><span class="cgp-min-lamp"></span><span class="cgp-min-status-txt">—</span><span class="cgp-min-count"></span></div>
<div class="cgp-rows">
  <div class="cgp-row"><span>${t('costShort')}</span><span class="cgp-val cgp-min-cost">—</span></div>
  <div class="cgp-row"><span>${t('balance')}</span><span class="cgp-val cgp-min-bal">—</span></div>
  <div class="cgp-row"><span>${t('hitRate')}</span><span class="cgp-val cgp-min-hit">—</span></div>
  <div class="cgp-row"><span>${t('modelLabel')}</span><span class="cgp-val cgp-min-model">—</span></div>
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
              stxt.textContent = peak ? t('statusBusy') : t('statusIdle')
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
        id: 'ring', nameKey: 'skinRing', collapsible: false,
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
  <div class="cgp-ring-center"><div class="cgp-ring-num">—</div><div class="cgp-ring-label">${t('balance')}</div></div>
</div>
<div class="cgp-rows">
  <div class="cgp-row"><span>${t('costShort')}</span><span class="cgp-val cgp-rg-cost">—</span></div>
  <div class="cgp-row"><span>${t('hitRate')}</span><span class="cgp-val cgp-rg-hit">—</span></div>
  <div class="cgp-row"><span>${t('modelLabel')}</span><span class="cgp-val cgp-rg-model">—</span></div>
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
        id: 'bar', nameKey: 'skinBar', collapsible: false,
        build(el, st) {
          el.innerHTML = `
<div class="cgp-bar">
  <span class="cgp-bar-lamp"></span>
  <span class="cgp-bar-item"><i>${t('modelLabel')}</i><b class="cgp-bar-model">—</b></span>
  <span class="cgp-bar-item"><i>${t('hitRate')}</i><b class="cgp-bar-hit">—</b></span>
  <span class="cgp-bar-item"><i>${t('costShort')}</i><b class="cgp-bar-cost">—</b></span>
  <span class="cgp-bar-item"><i>${t('balance')}</i><b class="cgp-bar-bal">—</b></span>
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

    const B11_ARC_W = 11 // Basic 1.1 费率弧线宽（CSS 与几何共用；圆头半径 = B11_ARC_W/2）
    const B11_CSS = `
.cgp-b11{width:100%;box-sizing:border-box;text-align:center;user-select:none}
.cgp-b11 svg{display:block;margin:0 auto;width:100%;max-width:330px;height:auto}
.cgp-b11 .arc-bg{fill:none;stroke:rgba(255,255,255,.12);stroke-width:${B11_ARC_W};stroke-linecap:round}
.cgp-b11 .arc-std{fill:none;stroke:#22c55e;stroke-width:${B11_ARC_W};stroke-linecap:round}
.cgp-b11 .arc-peak{fill:none;stroke:#f59e0b;stroke-width:${B11_ARC_W};stroke-linecap:round}
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
      // 圆头线帽半径占用的弧长换算成表盘角度：每段弧两端各内缩该角度，
      // 圆头外缘正好止于时间边界（保留圆头、不侵入相邻时段）。
      const RATE_CAP_DEG = (B11_ARC_W / 2) / RATE_R * 180 / Math.PI // ≈5.43° ≈ 21.6 分钟

      function xy(p, r) { const a = (180 - p) * Math.PI / 180; return [CENTER_X + r * Math.cos(a), CENTER_Y - r * Math.sin(a)] }
      function arcD(a, b, r) { const [x1, y1] = xy(a, r); const [x2, y2] = xy(b, r); return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}` }
      // 费率弧：两端各内缩 RATE_CAP_DEG，圆头恰好抵在 a/b 边界上（相邻段在边界相切，无缝无越界）。
      function arcBand(a, b, r) { return arcD(a + RATE_CAP_DEG, b - RATE_CAP_DEG, r) }
      function bjParts() {
        const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(new Date())
        const g = (t) => Number(parts.find((p) => p.type === t)?.value) || 0
        const y = g('year'); const mo = g('month'); const d = g('day'); let h = g('hour'); if (h === 24) h = 0
        return { weekday: new Date(Date.UTC(y, mo - 1, d)).getUTCDay(), hour: h, minute: g('minute'), second: g('second') }
      }
      function dialPos(hf) { const t = ((hf % 24) + 24) % 24; if (t < 6) return 90 - 15 * t; if (t <= 18) return 15 * t - 90; return 15 * (t - 18) }
      function fmtRemain(s) { if (!Number.isFinite(s) || s < 0) return ''; const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const se = Math.floor(s % 60); if (h > 0) return t('remainHM', { h, m }); if (m > 0) return t('remainMS', { m, s: se }); return t('remainS', { s: se }) }
      function modelColor(key) { const k = String(key || '').toLowerCase(); if (k.includes('pro')) return '#fcd34d'; if (k.includes('vision')) return '#e879f9'; return '#7dd3fc' }

      return {
        id: 'basic11', nameKey: 'skinBasic11', collapsible: false,
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
    <div class="col"><span class="lab">${t('currentRate')}</span><span class="val st">—</span></div>
    <div class="col"><span class="lab">${t('nextSwitch')}</span><span class="val cd"></span></div>
  </div>
  <div class="rows">
    <div class="row"><span>${t('sessionCost')}</span><b class="cost">—</b></div>
    <div class="row"><span>${t('balance')}</span><b class="bal">—</b></div>
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
            // 只对黄段(高峰)做圆头内缩，且只缩内部边界（9:00 / 12:00 / 14:00）：黄段绘制在绿段之上，
            // 边界处的绿段圆头被黄段覆盖，可见边界由黄段精确决定；
            // 绿段保持原样，黄段在 18:00 的端头也保持原样（圆头不缩）。
            stdArc.setAttribute('d', arcD(0, 45, RATE_R) + arcD(90, 120, RATE_R))
            peakArc.setAttribute('d', arcBand(45, 90, RATE_R) + arcD(120 + RATE_CAP_DEG, 180, RATE_R))
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
              statusVal.textContent = peak ? t('statusPeak') : t('statusStd')
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
      classicSkin({ id: 'test1', nameKey: 'skinTest1', stars: true }),
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
      // 语言在挂载时确定一次；挂载后固定，不做运行时热切换。
      locale = detectLocale(ctx)
      L = I18N[locale] || I18N.en
      ctx.effect(() => {
        injectCss()

        const root = document.createElement('div')
        root.className = 'cgp-root'
        root.innerHTML = `
<div class="cgp-title" data-drag>
  <span class="cgp-title-text">${t('appTitle')}</span>
  <span class="cgp-alarm-dot" title="${t('balanceLight')}"></span>
  <button class="cgp-actbtn cgp-act-rec" type="button" title="${t('viewRecords')}">🗒</button>
  <button class="cgp-actbtn cgp-act-zero" type="button" title="${t('resetCostHint')}">↺</button>
  <button class="cgp-toggle" type="button" title="${t('minimize')}">−</button>
  <button class="cgp-gear" type="button" title="${t('gearTitle')}">⚙</button>
</div>
<div class="cgp-body"></div>
<div class="cgp-rec-panel">
  <div class="cgp-rec-head">
    <span class="cgp-rec-title">${t('sessionRecordsTitle')}</span>
    <span class="cgp-rec-total">${t('totalWithValue', { v: '¥0.00' })}</span>
    <button class="cgp-rec-close" type="button" title="${t('close')}">✕</button>
  </div>
  <div class="cgp-recbar">
    <div class="cgp-seg cgp-range">
      <button class="cgp-range-btn" data-range="all" type="button">${t('rangeAll')}</button>
      <button class="cgp-range-btn" data-range="year" type="button">${t('rangeYear')}</button>
      <button class="cgp-range-btn cgp-active" data-range="month" type="button">${t('rangeMonth')}</button>
      <button class="cgp-range-btn" data-range="week" type="button">${t('rangeWeek')}</button>
    </div>
    <div class="cgp-nav">
      <button class="cgp-prev" type="button" title="${t('prevPeriod')}">‹</button>
      <span class="cgp-range-label">—</span>
      <button class="cgp-next" type="button" title="${t('nextPeriod')}">›</button>
    </div>
    <div class="cgp-panel-actions">
      <div class="cgp-seg cgp-scopeseg">
        <button class="cgp-scope-btn cgp-active" data-scope="session" type="button" title="${t('scopeSessionTitle')}">${t('thisSession')}</button>
        <button class="cgp-scope-btn" data-scope="all" type="button" title="${t('scopeAllTitle')}">${t('allSessions')}</button>
      </div>
      <div class="cgp-seg cgp-viewseg">
        <button class="cgp-view-btn cgp-active" data-view="band" type="button">${t('byBand')}</button>
        <button class="cgp-view-btn" data-view="model" type="button">${t('byModel')}</button>
      </div>
      <button class="cgp-export" type="button" title="${t('exportTip')}">${t('exportBtn')}</button>
      <button class="cgp-open" type="button" title="${t('openTip')}" disabled>${t('openBtn')}</button>
    </div>
  </div>
  <div class="cgp-chart">
    <span class="cgp-chart-max"></span>
    <div class="cgp-bars"></div>
    <div class="cgp-legend"></div>
  </div>
  <div class="cgp-tablewrap"><table class="cgp-table"><thead></thead><tbody></tbody></table></div>
  <div class="cgp-rec-foot">${t('panelNote')}</div>
</div>
<div class="cgp-settings">
  <label>${t('skinLabel')}</label>
  <select class="cgp-skin"></select>
  <label style="margin-top:8px">${t('thresholdLabel')}</label>
  <input class="cgp-threshold" type="number" min="0" step="1" inputmode="decimal">
  <div class="cgp-classic-prefs" style="margin-top:8px">
    <div class="cgp-pref-row"><label>${t('ringWidthLabel')}</label><input class="cgp-ring-w" type="number" min="3" max="20" step="1"></div>
    <div class="cgp-pref-row"><label>${t('busyColorLabel')}</label><input class="cgp-ring-busy cgp-color" type="color"></div>
    <div class="cgp-pref-row"><label>${t('idleColorLabel')}</label><input class="cgp-ring-idle cgp-color" type="color"></div>
  </div>
  <label style="margin-top:8px">${t('excelFolderLabel')}</label>
  <div class="cgp-pathrow">
    <span class="cgp-path cgp-unset">${t('pathUnset')}</span>
    <button class="cgp-mini-btn cgp-pick" type="button" title="${t('pickFolderTitle')}">${t('select')}</button>
    <button class="cgp-mini-btn cgp-clearpath" type="button" title="${t('clearPathTitle')}">✕</button>
  </div>
</div>
<div class="cgp-toast"></div>
<div class="cgp-narrowbar" title="${t('narrowTip')}">
  <span class="cgp-narrow-lamp"></span>
  <span class="cgp-narrow-cost">—</span>
  <span class="cgp-narrow-bal">—</span>
  <span class="cgp-model-pill cgp-narrow-badge">—</span>
</div>
<div class="cgp-resizer" data-resize title="${t('resizeTip')}"></div>
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
        // 记录 / 归零 / 记录面板元素
        const recordBtnEl = root.querySelector('.cgp-act-rec')
        const zeroBtnEl = root.querySelector('.cgp-act-zero')
        const recordsEl = root.querySelector('.cgp-rec-panel')
        const recordsHeadEl = root.querySelector('.cgp-rec-head')
        const recordsCloseEl = root.querySelector('.cgp-rec-close')
        const rangeBtns = root.querySelectorAll('.cgp-range-btn')
        const scopeBtns = root.querySelectorAll('.cgp-scope-btn')
        const viewBtns = root.querySelectorAll('.cgp-view-btn')
        const prevBtnEl = root.querySelector('.cgp-prev')
        const nextBtnEl = root.querySelector('.cgp-next')
        const rangeLabelEl = root.querySelector('.cgp-range-label')
        const barsEl = root.querySelector('.cgp-bars')
        const chartMaxEl = root.querySelector('.cgp-chart-max')
        const legendEl = root.querySelector('.cgp-legend')
        const tableHeadEl = root.querySelector('.cgp-table thead')
        const tableBodyEl = root.querySelector('.cgp-table tbody')
        const recordsTotalEl = root.querySelector('.cgp-rec-total')
        const recordsTitleEl = root.querySelector('.cgp-rec-title')
        const exportBtnEl = root.querySelector('.cgp-export')
        const openBtnEl = root.querySelector('.cgp-open')
        const pathEl = root.querySelector('.cgp-path')
        const pickBtnEl = root.querySelector('.cgp-pick')
        const clearPathBtnEl = root.querySelector('.cgp-clearpath')
        const toastEl = root.querySelector('.cgp-toast')
        // Narrow (vertical minimized) bar: lamp + cost + balance + model badge, synced in render().
        const narrowBarEl = root.querySelector('.cgp-narrowbar')
        const narrowLampEl = root.querySelector('.cgp-narrow-lamp')
        const narrowCostEl = root.querySelector('.cgp-narrow-cost')
        const narrowBalEl = root.querySelector('.cgp-narrow-bal')
        const narrowBadgeEl = root.querySelector('.cgp-narrow-badge')

        for (const s of SKINS) {
          const o = document.createElement('option')
          o.value = s.id
          o.textContent = t(s.nameKey || s.id)
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
              ? t('balanceLowTitle', { bal: bal.total.toFixed(2), t: thr })
              : t('balanceOkTitle', { bal: bal.total.toFixed(2), t: thr })
          } else {
            root.classList.remove('cgp-alarm')
            alarmDotEl.title = (bal && bal.error) ? bal.error : t('balanceUnknown')
          }
          // Narrow bar content + lamp state, synced on every data update.
          const nCost = data.cost
          narrowCostEl.textContent = nCost && Number.isFinite(nCost.cost) ? fmtMoney(nCost.cost) : '—'
          narrowBadgeEl.textContent = pricingLabel(nCost && nCost.pricingKey)
          narrowBalEl.textContent = (bal && bal.total !== undefined && Number.isFinite(bal.total))
            ? fmtMoney(bal.total)
            : ((bal && bal.error) ? t('balanceQueryFailed') : '—')
          narrowBarEl.classList.toggle('cgp-narrow-peak', !!(data.rate && data.rate.peak))
          narrowBarEl.classList.toggle('cgp-narrow-working', working)
          narrowLampEl.title = alarmDotEl.title
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

        /* ================================================================
         * Very narrow viewport -> vertical minimized bar (ResizeObserver + hysteresis)
         * Takes priority over expanded/collapsed. Thresholds can be overridden through
         * localStorage: dsh-cost-gauge-plus:narrowEnter / dsh-cost-gauge-plus:narrowExit.
         * ================================================================ */
        const narrowEnterCfg = Number(loadJSON('narrowEnter'))
        const narrowExitCfg = Number(loadJSON('narrowExit'))
        const NARROW_ENTER = narrowEnterCfg > 0 ? narrowEnterCfg : 780
        const NARROW_EXIT = narrowExitCfg > 0 ? narrowExitCfg : Math.max(NARROW_ENTER + 40, 860)
        let narrowMode = false
        let narrowDismissed = false // expanded from the bar: no auto-narrowing until the window is wide again
        let narrowSnapshot = null // width / collapsed state captured right before entering narrow mode
        const narrowWidthCfg = Number(loadJSON('narrowWidth'))
        const NARROW_W = narrowWidthCfg > 0 ? narrowWidthCfg : 36 // 竖条宽度（可 localStorage 覆盖）

        // ===== 侧边栏状态探测 =====
        // DSH 在自动收起侧栏时会切换 [data-dsh-frame][data-sidebar-collapsed]；再用实测宽度兜底。
        function getSidebarEl() {
          try {
            return document.querySelector('[class*="sidebarCol" i], aside[class*="sidebar" i]')
          } catch { return null }
        }
        function sidebarCollapsedNow() {
          try {
            const frame = document.querySelector('[data-dsh-frame]')
            if (frame && frame.hasAttribute('data-sidebar-collapsed')) return true
            const side = getSidebarEl()
            if (side) {
              const w = side.getBoundingClientRect().width
              if (w > 0 && w <= 96) return true
            }
          } catch {}
          return false
        }

        /** Keep the whole window inside the viewport (narrow mode shrinks it, so an off-screen
         *  position saved for a wide window would otherwise leave a 48px strip unreachable).
         *  @param {boolean} save 是否把钳制后的位置写回 localStorage（竖版停靠期间不写） */
        function clampRootIntoView(save = true) {
          // 视口为 0（窗口最小化 / 后台标签页）时不要钳制：否则会把位置算成 (8,8) 并写进 localStorage。
          if (window.innerWidth < 1 || window.innerHeight < 1) return
          const margin = 8
          const w = root.offsetWidth || 0
          const h = root.offsetHeight || 0
          const maxX = Math.max(margin, window.innerWidth - w - margin)
          const maxY = Math.max(margin, window.innerHeight - h - margin)
          const x = Math.min(Math.max(margin, root.offsetLeft), maxX)
          const y = Math.min(Math.max(margin, root.offsetTop), maxY)
          if (x !== root.offsetLeft || y !== root.offsetTop) {
            root.style.left = x + 'px'
            root.style.top = y + 'px'
            if (save) saveJSON('pos', { x, y })
          }
        }

        // ===== 对话区矩形 + 窗口尺寸变化时自动让位 =====
        /** 中间对话面板：frame 中位于侧栏右侧、足够宽高的最宽子元素（回退 scrollBody）。 */
        let chatPanelEl = null // 最近识别到的对话面板元素：把 scrollBody / 输入卡的查找限定在中间列里
        function getChatAreaRect() {
          try {
            chatPanelEl = null
            const side = getSidebarEl()
            const sideRight = side ? side.getBoundingClientRect().right : 0
            const frame = document.querySelector('[data-dsh-frame]')
            let best = null
            if (frame) {
              for (const el of frame.children) {
                const r = el.getBoundingClientRect()
                if (r.width < 300 || r.height < window.innerHeight * 0.5) continue
                if (r.left < sideRight - 4) continue
                if (!best || r.width > best.width) { best = r; chatPanelEl = el }
              }
            }
            if (!best) {
              const sb = document.querySelector('[class*="scrollBody" i]')
              if (sb) { best = sb.getBoundingClientRect(); chatPanelEl = sb }
            }
            return best
          } catch { return null }
        }
        /** 把 clamp()/calc() 之类的 CSS 长度表达式交给浏览器算成 px。 */
        function resolveCssLength(expr) {
          try {
            const probe = document.createElement('div')
            probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:' + expr
            document.body.appendChild(probe)
            const w = probe.getBoundingClientRect().width
            probe.remove()
            return w
          } catch { return NaN }
        }
        /** 对话「内容列」矩形：面板内居中、宽度 = --dsh-chat-content-width 的实际内容带（两侧留白不算内容）。 */
        function getChatContentRect() {
          const panel = getChatAreaRect()
          if (!panel) return null
          let w = NaN
          let padded = false
          try {
            const sb = (chatPanelEl && chatPanelEl.querySelector ? chatPanelEl.querySelector('[class*="scrollBody" i]') : null)
              || document.querySelector('[class*="scrollBody" i]')
            const raw = (getComputedStyle(sb || document.body).getPropertyValue('--dsh-chat-content-width') || '').trim()
            if (/^[\d.]+px$/.test(raw)) w = parseFloat(raw)
            else if (raw) w = resolveCssLength(raw)
            if (!(w > 0 && w <= panel.width)) w = NaN // 表达式非法/量到的不是内容列宽度：走退路
          } catch {}
          if (!Number.isFinite(w) || w <= 0) {
            // 退路：对话面板里居中的输入卡（宽度 = 内容列 + 两侧 16px 留白）。
            try {
              const hero = (chatPanelEl && chatPanelEl.querySelector ? chatPanelEl.querySelector('[class*="composerHero" i]') : null)
                || document.querySelector('[class*="composerHero" i]')
              if (hero) {
                const hr = hero.getBoundingClientRect()
                if (hr.width > 120 && hr.width < panel.width) { w = hr.width; padded = true }
              }
            } catch {}
          }
          if (!Number.isFinite(w) || w <= 0) { w = panel.width; padded = true }
          if (!padded) w += 32 // 内容列 + 两侧 16px 安全边距
          w = Math.min(w, panel.width)
          const left = panel.left + (panel.width - w) / 2
          return { left, right: left + w, top: panel.top, bottom: panel.bottom, width: w, height: panel.height }
        }
        // 规则：拉伸/缩放窗口后若浮窗压住了对话内容列，就把它挪到这一侧的空白处（偏左→往左让，偏右→往右让）。
        // 每侧优先落在面板内的留白（内容列旁边），放不下再退到面板外（侧栏/右侧空档）；
        // 首选侧放不下时用另一侧；两侧都不行则保持原位。只在窗口尺寸变化时触发，不干扰手动拖拽，竖版不参与。
        const CHAT_GAP = 8
        let chatYieldTimer = 0
        /** 两矩形相交面积（不相交为 0）。 */
        function overlapArea(a, b) {
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
          const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
          return (w > 0 && h > 0) ? w * h : 0
        }
        /** 底部输入框区域：composer seat → 输入卡 → 覆盖层。 */
        function getComposerRect() {
          try {
            const pick = (sel) => (chatPanelEl && chatPanelEl.querySelector ? chatPanelEl.querySelector(sel) : null) || document.querySelector(sel)
            // 用「输入卡」本身判定（而不是横跨整个面板的 seat 容器）：内容列两侧的留白本身是空的，
            // 停在那里不该被当成压住输入框。
            const el = pick('[class*="composerHero" i]') || pick('[data-conversation-composer-overlay]') || pick('[class*="composerSeat" i]')
            if (!el) return null
            const r = el.getBoundingClientRect()
            if (r.width < 80 || r.height < 20) return null
            return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }
          } catch { return null }
        }
        /** 两侧侧栏（左：sidebarCol/aside；右：rightbarCol）。收起状态（窄于 40px）不算。 */
        function getSidebarRects() {
          const out = []
          try {
            for (const el of [getSidebarEl(), document.querySelector('[class*="rightbarCol" i]')]) {
              if (!el) continue
              const r = el.getBoundingClientRect()
              if (r.width < 40 || r.height < 80) continue
              out.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height })
            }
          } catch {}
          return out
        }
        // 打分优先级：不压「对话内容列」（硬约束）→ 不压底部输入框 → 不压两侧侧栏；
        // 同分保留先考察的落点（即更符合「偏左往左、偏右往右」且移动更小的那个）。
        function keepOutOfChatArea() {
          if (narrowMode || dragging || resizing) return
          const panel = getChatAreaRect()
          const content = getChatContentRect()
          if (!panel || !content) return
          const rr = root.getBoundingClientRect()
          const w = rr.width
          const h = rr.height
          // 与内容列的交集：几乎没有遮挡就不动。
          const ox = Math.min(rr.right, content.right) - Math.max(rr.left, content.left)
          const oy = Math.min(rr.bottom, content.bottom) - Math.max(rr.top, content.top)
          if (ox < 32 || oy < Math.min(20, h * 0.25)) return
          const composer = getComposerRect()
          const bars = getSidebarRects()
          const minX = 8
          const maxX = window.innerWidth - w - 8
          const minY = 8
          const maxY = Math.max(minY, window.innerHeight - h - 8)
          const y0 = Math.round(Math.min(Math.max(minY, rr.top), maxY))
          const ys = [y0]
          if (composer) {
            // 允许同时上移，躲开底部输入框。
            const above = Math.round(composer.top - h - CHAT_GAP)
            if (above >= minY && above <= maxY && above !== y0) ys.push(above)
          }
          /** 该横向位置上是否会与底部输入卡相撞（左右各留 CHAT_GAP 余量）。 */
          const cardSide = (v) => !!composer && v < composer.right + CHAT_GAP && v + w > composer.left - CHAT_GAP
          /** 留白里靠下放置的 y：能贴底就贴底，会撞到输入卡就停在输入卡上方。 */
          const bottomYOf = (v) => cardSide(v) ? Math.round(Math.min(maxY, composer.top - h - CHAT_GAP)) : maxY
          const cx = (rr.left + rr.right) / 2
          const contentCx = (content.left + content.right) / 2
          // 每侧两个落点：
          //   1) 面板内「内容列与侧栏之间的留白」——够宽就停在留白正中（既不压文字区也不压侧栏）；
          //   2) 面板外的空档（会压到侧栏，只在留白放不下时使用）。
          const candidates = (side) => side < 0
            ? [
              { x: panel.left + (content.left - panel.left - w) / 2, inside: () => (content.left - panel.left) >= w + CHAT_GAP * 2, bottom: true },
              { x: panel.left - w - CHAT_GAP },
            ]
            : [
              { x: content.right + (panel.right - content.right - w) / 2, inside: () => (panel.right - content.right) >= w + CHAT_GAP * 2, bottom: true },
              { x: panel.right + CHAT_GAP },
            ]
          const order = cx < contentCx ? [-1, 1] : [1, -1]
          let best = null
          const consider = (x, y) => {
            if (x < minX - 0.5 || x > maxX + 0.5 || y < minY - 0.5 || y > maxY + 0.5) return
            const box = { left: x, right: x + w, top: y, bottom: y + h }
            if (overlapArea(box, content) > 0) return
            const mOver = composer ? overlapArea(box, composer) : 0
            let sOver = 0
            for (const b of bars) sOver += overlapArea(box, b)
            if (!best || mOver < best.mOver || (mOver === best.mOver && sOver < best.sOver)) best = { x, y, mOver, sOver }
          }
          for (const side of order) {
            for (const cand of candidates(side)) {
              const v = Math.round(cand.x)
              if (cand.inside && !cand.inside(v)) continue
              // 面板内留白 → 靠下放置；面板外的空档 → 沿用当前位置（尽量少动）。
              const list = cand.bottom ? [bottomYOf(v), y0].filter((y, i, a) => a.indexOf(y) === i) : ys
              for (const y of list) consider(v, y)
            }
          }
          if (!best) return
          if (best.x === root.offsetLeft && best.y === root.offsetTop) return
          root.style.left = best.x + 'px'
          root.style.top = best.y + 'px'
          saveJSON('pos', { x: best.x, y: best.y })
        }
        function onWindowResizeYield() {
          if (chatYieldTimer) clearTimeout(chatYieldTimer)
          chatYieldTimer = setTimeout(keepOutOfChatArea, 150)
        }
        window.addEventListener('resize', onWindowResizeYield)

        // ===== 竖版停靠：自动移动到 DSH 侧边栏「会话 / 工作区」标题下方 =====
        // 优先级：字面「会话/Sessions」标题 → 「工作区/Workspaces」分组标题 → 「新会话」按钮 → 保持原位
        const DOCK_TEXTS = ['会话', 'Sessions', 'Session', '工作区', 'Workspaces', 'Workspace']
        function ownTextOf(el) {
          let s = ''
          for (const n of el.childNodes) if (n.nodeType === 3) s += n.textContent
          return s.trim()
        }
        function findDockAnchor() {
          try {
            const visible = (r) => r.width >= 8 && r.height >= 8 && r.top < window.innerHeight * 0.85
            const inSide = (r) => r.left < Math.min(360, window.innerWidth * 0.45)
            const best = {}
            for (const el of document.querySelectorAll('span, button, div, h1, h2, h3, h4, p')) {
              if (el.closest('.cgp-root')) continue
              const own = ownTextOf(el)
              if (!own || own.length > 10) continue
              const idx = DOCK_TEXTS.indexOf(own)
              if (idx < 0) continue
              const r = el.getBoundingClientRect()
              if (!visible(r) || !inSide(r)) continue
              if (best[idx] === undefined || r.top < best[idx].top) best[idx] = { top: r.top, rect: r }
            }
            for (let i = 0; i < DOCK_TEXTS.length; i++) if (best[i]) return best[i].rect
            const ns = document.querySelector('[class*="newSession" i]')
            if (ns) {
              const r = ns.getBoundingClientRect()
              if (visible(r) && inSide(r)) return r
            }
          } catch {}
          return null
        }
        /** 竖条定位（钳制在窗口内；不写入 localStorage —— 停靠是临时的）。 */
        function placeNarrow(x, y) {
          const w = root.offsetWidth || NARROW_W
          const h = root.offsetHeight || 150
          const nx = Math.min(Math.max(8, Math.round(x)), Math.max(8, window.innerWidth - w - 8))
          const ny = Math.min(Math.max(8, Math.round(y)), Math.max(8, window.innerHeight - h - 8))
          root.style.left = nx + 'px'
          root.style.top = ny + 'px'
        }
        /** 停靠：侧栏收起时停在它右侧；否则停在「会话 / 工作区」标题下方。 */
        function dockNarrowToSessions() {
          try {
            if (sidebarCollapsedNow()) {
              const side = getSidebarEl()
              if (side) {
                const r = side.getBoundingClientRect()
                if (r.width > 0 && r.height > 0) {
                  placeNarrow(r.right + 8, r.top + 8)
                  return true
                }
              }
            }
            const rect = findDockAnchor()
            if (rect) {
              placeNarrow(rect.left, rect.bottom + 8)
              return true
            }
          } catch {}
          return false
        }

        function applyNarrow() {
          root.classList.toggle('cgp-narrow', narrowMode)
          if (narrowMode) {
            if (!narrowSnapshot) {
              narrowSnapshot = {
                width: root.style.width,
                collapsed,
                collapsedClass: root.classList.contains('cgp-collapsed'),
                left: root.style.left,
                top: root.style.top,
              }
            }
            root.style.setProperty('width', NARROW_W + 'px', 'important')
            if (!dockNarrowToSessions()) clampRootIntoView(false)
          } else if (narrowSnapshot) {
            // Leaving narrow mode: restore width, collapsed state and position the user had before.
            root.style.removeProperty('width')
            collapsed = narrowSnapshot.collapsed
            saveJSON('collapsed', collapsed)
            root.classList.toggle('cgp-collapsed', narrowSnapshot.collapsedClass)
            root.style.width = narrowSnapshot.width
            if (narrowSnapshot.left) root.style.left = narrowSnapshot.left
            if (narrowSnapshot.top) root.style.top = narrowSnapshot.top
            toggleEl.textContent = narrowSnapshot.collapsedClass ? '＋' : '−'
            toggleEl.title = narrowSnapshot.collapsedClass ? t('expandTip') : t('minimize')
            narrowSnapshot = null
            clampRootIntoView()
          } else {
            root.style.removeProperty('width')
            clampRootIntoView()
          }
        }
        /**
         * 触发：视口过窄（< NARROW_ENTER）**或** 左侧边栏收起（DSH 自动缩小时）。
         * 退出：视口 ≥ NARROW_EXIT 且侧栏已展开（迟滞避免抖动）。
         */
        function evaluateNarrow() {
          const w = window.innerWidth
          const rail = sidebarCollapsedNow()
          if (narrowDismissed && w >= NARROW_EXIT && !rail) narrowDismissed = false
          const shouldEnter = w < NARROW_ENTER || rail
          const shouldStay = w < NARROW_EXIT || rail
          const should = !narrowDismissed && (narrowMode ? shouldStay : shouldEnter)
          if (should !== narrowMode) {
            narrowMode = should
            applyNarrow()
          } else if (narrowMode) {
            // 已在竖版：视口/侧栏变化时重新停靠
            if (!dockNarrowToSessions()) clampRootIntoView(false)
          } else {
            // 视口变化但状态未变：仍要保证浮窗完整落在窗口内
            clampRootIntoView()
          }
        }
        const onWindowResizeClamp = () => { if (narrowMode) { if (!dockNarrowToSessions()) clampRootIntoView(false) } else clampRootIntoView() }
        window.addEventListener('resize', onWindowResizeClamp)
        // 侧栏属性/尺寸变化时立即重算（DSH 自动收起时会切换 data-sidebar-collapsed）
        let sideObserver = null
        let sideObserverTarget = null
        let frameAttrObserver = null
        let narrowRecheckTimer = null
        function watchSidebar() {
          try {
            if (!frameAttrObserver) {
              frameAttrObserver = new MutationObserver(() => scheduleNarrowRecheck())
              frameAttrObserver.observe(document.body, {
                subtree: true,
                attributes: true,
                attributeFilter: ['data-sidebar-collapsed'],
              })
            }
            const side = getSidebarEl()
            if (side && typeof ResizeObserver === 'function' && side !== sideObserverTarget) {
              if (sideObserver) sideObserver.disconnect()
              sideObserver = new ResizeObserver(() => scheduleNarrowRecheck())
              sideObserver.observe(side)
              sideObserverTarget = side
            }
          } catch {}
        }
        /**
         * 观察回调统一入口：立即重算 + 160ms 后补算一次。
         * 侧栏展开时「属性移除」与「宽度变化」可能不在同一帧，补算可避免漏判。
         */
        function scheduleNarrowRecheck() {
          evaluateNarrow()
          watchSidebar()
          if (narrowRecheckTimer) clearTimeout(narrowRecheckTimer)
          narrowRecheckTimer = setTimeout(() => { evaluateNarrow(); watchSidebar() }, 160)
        }
        const narrowObserver = (typeof ResizeObserver === 'function')
          ? new ResizeObserver(() => scheduleNarrowRecheck())
          : undefined
        if (narrowObserver) narrowObserver.observe(document.documentElement)
        else window.addEventListener('resize', scheduleNarrowRecheck)
        watchSidebar()
        narrowBarEl.addEventListener('click', (e) => {
          e.stopPropagation()
          narrowDismissed = true
          narrowMode = false
          applyNarrow()
        })

        gearEl.addEventListener('click', () => {
          const open = root.classList.toggle('cgp-settings-open')
          if (open) refreshPrefs()
        })
        toggleEl.addEventListener('click', () => {
          collapsed = !collapsed
          saveJSON('collapsed', collapsed)
          root.classList.toggle('cgp-collapsed', collapsed)
          root.style.width = collapsed ? '' : sizeW + 'px'
          toggleEl.textContent = collapsed ? '＋' : '−'
          toggleEl.title = collapsed ? t('expandTip') : t('minimize')
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

        /* ================================================================
         * 记录面板（共享，挂在窗口根节点）+ 会话花费归零
         * ================================================================ */
        const SEG_COLORS = {
          std: '#22c55e', peak: '#f59e0b',
          pro: '#fcd34d', flash: '#7dd3fc', vision: '#e879f9',
        }
        const panel = {
          range: 'month', view: 'band',
          year: 0, month: 0, weekStart: '',
          days: [], groups: [], resetAt: null, excelDir: '', lastExport: '',
          scope: 'session', title: '', sessionCount: 0,
          x: null, y: null, // 面板位置（viewport 坐标，拖动后记忆）
        }
        let toastTimer = null
        let zeroTimer = null
        const PANEL_MARGIN = 8
        let panelDrag = null

        /** 北京时间的年月日 + 星期（面板时间轴用）。 */
        function bjDateParts() {
          const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric', month: '2-digit', day: '2-digit', hour12: false,
          }).formatToParts(new Date())
          const get = (t) => Number(parts.find((p) => p.type === t)?.value) || 0
          const year = get('year')
          const month = get('month')
          const day = get('day')
          return { year, month, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() }
        }
        function pad2(n) { return String(n).padStart(2, '0') }
        function money2(v) { return '¥' + (Number.isFinite(v) ? v : 0).toFixed(2) }
        function addDaysStr(s, n) {
          const d = new Date(s + 'T00:00:00Z')
          d.setUTCDate(d.getUTCDate() + n)
          return d.toISOString().slice(0, 10)
        }
        function weekStartOf(s) {
          const d = new Date(s + 'T00:00:00Z')
          return addDaysStr(s, -((d.getUTCDay() + 6) % 7))
        }
        function todayStr() {
          const p = bjDateParts()
          return p.year + '-' + pad2(p.month) + '-' + pad2(p.day)
        }
        function currentSessionId() {
          try { return ctx.sessions.list.getSnapshot().current } catch { return undefined }
        }
        function lastDayOfMonthKey(ym) {
          const y = Number(ym.slice(0, 4))
          const m = Number(ym.slice(5, 7))
          const d = new Date(Date.UTC(y, m, 0)).getUTCDate()
          return ym + '-' + pad2(d)
        }
        function ymd(s) { return String(s).replace(/-/g, '') }

        // ===== 面板：可拖动 + 视口钳制（打开/拖动/窗口变化时越界自动拉回） =====
        /** 把面板放到 (x, y)，并保证完整落在窗口内。 */
        function placePanel(x, y) {
          const w = recordsEl.offsetWidth || 480
          const h = recordsEl.offsetHeight || 320
          const maxX = Math.max(PANEL_MARGIN, window.innerWidth - w - PANEL_MARGIN)
          const maxY = Math.max(PANEL_MARGIN, window.innerHeight - h - PANEL_MARGIN)
          panel.x = Math.min(Math.max(PANEL_MARGIN, Math.round(x)), maxX)
          panel.y = Math.min(Math.max(PANEL_MARGIN, Math.round(y)), maxY)
          recordsEl.style.left = panel.x + 'px'
          recordsEl.style.top = panel.y + 'px'
        }
        function clampPanelToView() {
          if (!root.classList.contains('cgp-rec-open')) return
          placePanel(panel.x, panel.y)
        }
        /** 打开面板：恢复上次位置（首次打开落在窗口下方），越界自动拉回。 */
        function openRecordsPanel() {
          const savedPanel = loadJSON('panelPos')
          let x = panel.x
          let y = panel.y
          if (!Number.isFinite(x) || !Number.isFinite(y)) {
            if (savedPanel && Number.isFinite(savedPanel.x) && Number.isFinite(savedPanel.y)) {
              x = savedPanel.x
              y = savedPanel.y
            } else {
              x = root.offsetLeft
              y = root.offsetTop + root.offsetHeight + PANEL_MARGIN
            }
          }
          root.classList.add('cgp-rec-open')
          placePanel(x, y)
          saveJSON('panelPos', { x: panel.x, y: panel.y })
        }
        function attachPanelDrag() {
          recordsHeadEl.addEventListener('pointerdown', (e) => {
            if (e.target.closest('button')) return
            panelDrag = { sx: e.clientX, sy: e.clientY, ox: panel.x, oy: panel.y }
            try { recordsHeadEl.setPointerCapture(e.pointerId) } catch {}
            e.preventDefault()
            e.stopPropagation()
          })
          recordsHeadEl.addEventListener('pointermove', (e) => {
            if (!panelDrag) return
            const ox = Number.isFinite(panelDrag.ox) ? panelDrag.ox : 0
            const oy = Number.isFinite(panelDrag.oy) ? panelDrag.oy : 0
            placePanel(ox + (e.clientX - panelDrag.sx), oy + (e.clientY - panelDrag.sy))
          })
          const end = () => {
            if (!panelDrag) return
            panelDrag = null
            saveJSON('panelPos', { x: panel.x, y: panel.y })
          }
          recordsHeadEl.addEventListener('pointerup', end)
          recordsHeadEl.addEventListener('pointercancel', end)
        }
        const onWindowResizePanel = () => clampPanelToView()
        window.addEventListener('resize', onWindowResizePanel)

        function showToast(msg, ok) {
          toastEl.textContent = msg
          toastEl.style.background = ok ? 'rgba(34,197,94,.16)' : 'rgba(239,68,68,.16)'
          toastEl.style.borderColor = ok ? 'rgba(34,197,94,.5)' : 'rgba(239,68,68,.5)'
          toastEl.style.color = ok ? '#bbf7d0' : '#fecaca'
          root.classList.add('cgp-toast-show')
          clearTimeout(toastTimer)
          toastTimer = setTimeout(() => root.classList.remove('cgp-toast-show'), 2600)
        }

        /** 导出内容实际覆盖的时间段（没有记录时回退到当前选择的时间段）。 */
        function periodSpan() {
          const groups = Array.isArray(panel.groups) ? panel.groups : []
          if (groups.length) {
            const first = String(groups[0].key || '')
            const last = String(groups[groups.length - 1].key || '')
            const start = first.length === 7 ? first + '-01' : first
            const end = last.length === 7 ? lastDayOfMonthKey(last) : last
            if (start && end) return { start, end }
          }
          ensurePanelCursor()
          if (panel.range === 'year') return { start: panel.year + '-01-01', end: panel.year + '-12-31' }
          if (panel.range === 'month') {
            const ym = panel.year + '-' + pad2(panel.month)
            return { start: ym + '-01', end: lastDayOfMonthKey(ym) }
          }
          if (panel.range === 'week') return { start: panel.weekStart, end: addDaysStr(panel.weekStart, 6) }
          const today = todayStr()
          return { start: today, end: today }
        }
        /** 默认文件名：会话名称_起-止（如 DeepSeek 花费_20260808-20260911）。 */
        function exportBaseName() {
          const scopeName = panel.scope === 'all' ? t('allSessions') : (panel.title || t('sessionFallback'))
          const span = periodSpan()
          return scopeName + '_' + ymd(span.start) + '-' + ymd(span.end)
        }
        /** 导出 Excel 首行说明。 */
        function exportNote() {
          const span = periodSpan()
          const scopeText = panel.scope === 'all'
            ? (t('allSessions') + (panel.sessionCount ? t('sessionCountShort', { n: panel.sessionCount }) : ''))
            : (t('thisSession') + ' · ' + (panel.title || t('sessionFallback')))
          const reset = panel.scope === 'session' && panel.resetAt
            ? new Date(panel.resetAt).toLocaleString(localeTag(), { hour12: false })
            : t('none')
          return t('exportNoteSession') + scopeText
            + ' · ' + t('exportNoteBilling') + span.start + ' ~ ' + span.end
            + ' · ' + t('exportNoteRange') + rangeText()
            + ' · ' + t('exportNoteLastReset') + reset
            + ' · ' + t('exportNoteExportedAt') + new Date().toLocaleString(localeTag(), { hour12: false })
        }
        function ensurePanelCursor() {
          if (panel.year) return
          const p = bjDateParts()
          panel.year = p.year
          panel.month = p.month
          panel.weekStart = weekStartOf(todayStr())
        }
        function dayIndex() {
          const map = {}
          for (const d of panel.days) map[d.date] = d
          return map
        }
        function sumDays(days, map) {
          const g = { std: 0, peak: 0, pro: 0, flash: 0, vision: 0, total: 0 }
          for (const ds of days) {
            const d = map[ds]
            if (!d) continue
            g.std += d.std; g.peak += d.peak; g.pro += d.pro; g.flash += d.flash; g.vision += d.vision; g.total += d.total
          }
          return g
        }
        function rangeText() {
          if (panel.range === 'all') return t('rangeAll')
          if (panel.range === 'year') return t('rangeYearText', { year: panel.year })
          if (panel.range === 'month') return panel.year + '-' + pad2(panel.month)
          return panel.weekStart + ' ~ ' + addDaysStr(panel.weekStart, 6)
        }
        function buildGroups() {
          ensurePanelCursor()
          const map = dayIndex()
          const dates = Object.keys(map).sort()
          const out = []
          if (panel.range === 'all') {
            const months = []
            for (const d of dates) { const m = d.slice(0, 7); if (months.indexOf(m) < 0) months.push(m) }
            for (const m of months) {
              const days = dates.filter((d) => d.slice(0, 7) === m)
              out.push(Object.assign({ key: m, label: m.replace('-', '/') }, sumDays(days, map)))
            }
          } else if (panel.range === 'year') {
            for (let mo = 1; mo <= 12; mo++) {
              const prefix = panel.year + '-' + pad2(mo)
              const days = dates.filter((d) => d.slice(0, 7) === prefix)
              out.push(Object.assign({ key: prefix, label: t('monthLabel', { m: pad2(mo) }), short: pad2(mo) }, sumDays(days, map)))
            }
          } else if (panel.range === 'month') {
            const prefix = panel.year + '-' + pad2(panel.month)
            const last = new Date(Date.UTC(panel.year, panel.month, 0)).getUTCDate()
            for (let dy = 1; dy <= last; dy++) {
              const ds = prefix + '-' + pad2(dy)
              out.push(Object.assign({ key: ds, label: pad2(dy), short: pad2(dy) }, sumDays([ds], map)))
            }
          } else {
            const wdNames = [t('wdMon'), t('wdTue'), t('wdWed'), t('wdThu'), t('wdFri'), t('wdSat'), t('wdSun')]
            for (let w = 0; w < 7; w++) {
              const ds = addDaysStr(panel.weekStart, w)
              out.push(Object.assign({ key: ds, label: wdNames[w] + ' ' + ds.slice(5), short: ds.slice(5) }, sumDays([ds], map)))
            }
          }
          return out
        }
        function isAtLatest() {
          const today = todayStr()
          if (panel.range === 'year') return panel.year >= Number(today.slice(0, 4))
          if (panel.range === 'month') {
            return panel.year === Number(today.slice(0, 4)) && panel.month >= Number(today.slice(5, 7))
          }
          if (panel.range === 'week') return panel.weekStart >= weekStartOf(today)
          return true
        }
        function shiftPeriod(delta) {
          if (panel.range === 'year') { panel.year += delta; return }
          if (panel.range === 'month') {
            let mo = panel.month + delta
            let y = panel.year
            if (mo < 1) { mo = 12; y -= 1 } else if (mo > 12) { mo = 1; y += 1 }
            panel.month = mo; panel.year = y; return
          }
          if (panel.range === 'week') panel.weekStart = addDaysStr(panel.weekStart, delta * 7)
        }
        function segsFor(g) {
          return panel.view === 'band'
            ? [['std', t('offPeak'), g.std], ['peak', t('peak'), g.peak]]
            : [['pro', 'v4-pro', g.pro], ['flash', 'v4-flash', g.flash], ['vision', 'flash-vision', g.vision]]
        }
        function renderPanel() {
          const groups = buildGroups()
          // 明细与导出只列出「有使用记录」的时段；柱状图仍按完整时间轴展示。
          const used = groups.filter((g) => (Number(g.total) || 0) > 1e-9)
          const sum = { std: 0, peak: 0, pro: 0, flash: 0, vision: 0, total: 0 }
          let max = 0.0001
          for (const g of groups) {
            sum.std += g.std; sum.peak += g.peak; sum.pro += g.pro
            sum.flash += g.flash; sum.vision += g.vision; sum.total += g.total
            if (g.total > max) max = g.total
          }
          recordsTotalEl.textContent = t('totalWithValue', { v: money2(sum.total) })
          recordsTitleEl.textContent = panel.scope === 'all'
            ? t('allRecordsTitle') + (panel.sessionCount ? t('sessionCountSuffix', { n: panel.sessionCount }) : '')
            : t('thisSession') + ' · ' + (panel.title || t('spendRecords')) +
              (panel.resetAt ? t('lastResetSuffix', { t: new Date(panel.resetAt).toLocaleString(localeTag(), { hour12: false }) }) : '')
          rangeLabelEl.textContent = rangeText()
          prevBtnEl.style.display = panel.range === 'all' ? 'none' : ''
          nextBtnEl.style.display = panel.range === 'all' ? 'none' : ''
          nextBtnEl.disabled = isAtLatest()
          chartMaxEl.textContent = t('maxWithValue', { v: money2(max) })

          let bars = ''
          for (const g of groups) {
            const segs = segsFor(g)
            const tip = g.label + ' · ' + t('totalWithValue', { v: money2(g.total) }) + '\n' +
              segs.map((s) => s[1] + ' ' + money2(s[2])).join('\n')
            let inner = ''
            const reversed = segs.slice().reverse()
            for (const s of reversed) {
              if (!(s[2] > 0)) continue
              inner += '<div class="cgp-chart-seg" style="height:' + (s[2] / max * 100).toFixed(2) +
                '%;background:' + SEG_COLORS[s[0]] + '"></div>'
            }
            bars += '<div class="cgp-chart-bar" title="' + tip + '"><div class="cgp-chart-stack">' + inner +
              '</div><div class="cgp-chart-label">' + (g.short !== undefined ? g.short : g.label) + '</div></div>'
          }
          barsEl.innerHTML = groups.length ? bars : ''

          let legend = ''
          const legendItems = panel.view === 'band'
            ? [['std', t('offPeak')], ['peak', t('peak')]]
            : [['pro', 'v4-pro'], ['flash', 'v4-flash'], ['vision', 'flash-vision']]
          for (const s of legendItems) {
            legend += '<span><i style="background:' + SEG_COLORS[s[0]] + '"></i>' + s[1] + '</span>'
          }
          legendEl.innerHTML = legend

          const head = panel.view === 'band'
            ? [t('period'), t('offPeak'), t('peak'), t('total')]
            : [t('period'), 'v4-pro', 'v4-flash', 'flash-vision', t('total')]
          tableHeadEl.innerHTML = '<tr>' + head.map((h) => '<th>' + h + '</th>').join('') + '</tr>'
          let rows = ''
          for (const g of used) {
            rows += panel.view === 'band'
              ? '<tr><td>' + g.label + '</td><td class="cgp-cell-std">' + money2(g.std) +
                '</td><td class="cgp-cell-peak">' + money2(g.peak) + '</td><td>' + money2(g.total) + '</td></tr>'
              : '<tr><td>' + g.label + '</td><td>' + money2(g.pro) + '</td><td>' + money2(g.flash) +
                '</td><td>' + money2(g.vision) + '</td><td>' + money2(g.total) + '</td></tr>'
          }
          if (used.length === 0) {
            rows = '<tr><td colspan="' + head.length + '" class="cgp-rec-empty">' + t('noRecords') + '</td></tr>'
          } else {
            rows += panel.view === 'band'
              ? '<tr class="cgp-sum"><td>' + t('total') + '</td><td>' + money2(sum.std) + '</td><td>' + money2(sum.peak) + '</td><td>' + money2(sum.total) + '</td></tr>'
              : '<tr class="cgp-sum"><td>' + t('total') + '</td><td>' + money2(sum.pro) + '</td><td>' + money2(sum.flash) + '</td><td>' + money2(sum.vision) + '</td><td>' + money2(sum.total) + '</td></tr>'
          }
          tableBodyEl.innerHTML = rows
          panel.groups = used
          // 内容渲染后高度会变，重新钳制一次，保证整块面板仍在窗口内
          if (root.classList.contains('cgp-rec-open')) clampPanelToView()
        }
        async function fetchRecords() {
          try {
            const sid = currentSessionId()
            const params = []
            if (sid) params.push('session=' + encodeURIComponent(sid))
            if (panel.scope === 'all') params.push('scope=all')
            const res = await fetch('/api/cost-gauge-plus/records' + (params.length ? '?' + params.join('&') : ''))
            if (!res.ok) throw new Error('HTTP ' + res.status)
            const data = await res.json()
            panel.days = Array.isArray(data.days) ? data.days : []
            panel.resetAt = data.scope === 'all' ? null : (data.resetAt || null)
            panel.title = data.title || ''
            panel.sessionCount = Number(data.sessionCount) || 0
          } catch {
            panel.days = []
          }
          renderPanel()
        }
        function setPathDisplay(dir) {
          panel.excelDir = dir || ''
          if (panel.excelDir) {
            pathEl.textContent = panel.excelDir
            pathEl.classList.remove('cgp-unset')
          } else {
            pathEl.textContent = t('pathUnset')
            pathEl.classList.add('cgp-unset')
          }
        }
        async function refreshPrefs() {
          try {
            const res = await fetch('/api/cost-gauge-plus/prefs')
            if (!res.ok) return
            const data = await res.json()
            setPathDisplay(data.excelDir || '')
            panel.lastExport = data.lastExport || ''
            openBtnEl.disabled = !panel.lastExport
          } catch {}
        }
        function exportPayload() {
          // 与面板明细一致：只导出有使用记录的时段（panel.groups 已过滤）
          const groups = Array.isArray(panel.groups) ? panel.groups : buildGroups()
          const sum = groups.reduce((a, g) => {
            a.std += g.std; a.peak += g.peak; a.total += g.total
            a.pro += g.pro; a.flash += g.flash; a.vision += g.vision
            return a
          }, { std: 0, peak: 0, total: 0, pro: 0, flash: 0, vision: 0 })
          const round2 = (v) => Number(v.toFixed(2))
          const bandRows = groups.length
            ? groups.map((g) => [g.label, round2(g.std), round2(g.peak), round2(g.total)])
              .concat([[t('total'), round2(sum.std), round2(sum.peak), round2(sum.total)]])
            : [[t('noRecords'), 0, 0, 0]]
          const modelRows = groups.length
            ? groups.map((g) => [g.label, round2(g.pro), round2(g.flash), round2(g.vision), round2(g.total)])
              .concat([[t('total'), round2(sum.pro), round2(sum.flash), round2(sum.vision), round2(sum.total)]])
            : [[t('noRecords'), 0, 0, 0, 0]]
          return {
            rangeLabel: rangeText(),
            fileName: exportBaseName(),
            note: exportNote(),
            bandHead: [t('period'), t('offPeak'), t('peak'), t('total')],
            bandRows,
            modelHead: [t('period'), 'v4-pro', 'v4-flash', 'flash-vision', t('total')],
            modelRows,
          }
        }
        async function doExport() {
          try {
            const res = await fetch('/api/cost-gauge-plus/export', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(exportPayload()),
            })
            const data = await res.json()
            if (data && data.ok) {
              panel.lastExport = data.path
              setPathDisplay(data.dir || panel.excelDir)
              openBtnEl.disabled = false
              showToast(t('toastExported', { path: data.path }), true)
            } else if (data && data.cancelled) {
              showToast(t('toastExportCancelled'), false)
            } else {
              showToast(t('toastExportFailed', { msg: (data && data.error) || t('unknownError') }), false)
            }
          } catch (e) {
            showToast(t('toastExportFailed', { msg: e && e.message ? e.message : String(e) }), false)
          }
        }
        async function doOpen() {
          if (!panel.lastExport) return
          try {
            const res = await fetch('/api/cost-gauge-plus/open-folder', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ path: panel.lastExport }),
            })
            const data = await res.json()
            if (data && data.ok) showToast(t('toastRevealed', { path: panel.lastExport }), true)
            else showToast(t('toastOpenFailed', { msg: (data && data.error) || t('unknownError') }), false)
          } catch (e) {
            showToast(t('toastOpenFailed', { msg: e && e.message ? e.message : String(e) }), false)
          }
        }
        async function doPickFolder() {
          try {
            const res = await fetch('/api/cost-gauge-plus/pick-folder', { method: 'POST' })
            const data = await res.json()
            if (data && data.ok) {
              setPathDisplay(data.excelDir || '')
              showToast(t('toastDefaultSet', { path: data.excelDir }), true)
            } else if (data && data.cancelled) {
              showToast(t('toastPickCancelled'), false)
            } else {
              showToast(t('toastSettingFailed', { msg: (data && data.error) || t('unknownError') }), false)
            }
          } catch (e) {
            showToast(t('toastSettingFailed', { msg: e && e.message ? e.message : String(e) }), false)
          }
        }
        async function doClearFolder() {
          try {
            const res = await fetch('/api/cost-gauge-plus/prefs', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ excelDir: '' }),
            })
            const data = await res.json()
            if (data && data.ok) {
              setPathDisplay('')
              showToast(t('toastCleared'), true)
            } else {
              showToast(t('toastClearFailed'), false)
            }
          } catch {}
        }
        async function doReset() {
          const sid = currentSessionId()
          if (!sid) { showToast(t('toastNoSession'), false); return }
          try {
            const res = await fetch('/api/cost-gauge-plus/reset', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ session: sid }),
            })
            const data = await res.json()
            if (data && data.ok) {
              showToast(t('toastResetDone'), true)
              poll()
              fetchRecords()
            } else {
              showToast(t('toastResetFailed', { msg: (data && data.error) || t('unknownError') }), false)
            }
          } catch (e) {
            showToast(t('toastResetFailed', { msg: e && e.message ? e.message : String(e) }), false)
          }
        }
        function resetZeroButton() {
          zeroBtnEl.dataset.confirm = '0'
          zeroBtnEl.classList.remove('cgp-confirming')
          zeroBtnEl.textContent = '↺'
          zeroBtnEl.title = t('resetCostHint')
        }
        function bindPanel() {
          recordBtnEl.addEventListener('click', (e) => {
            e.stopPropagation()
            const open = root.classList.toggle('cgp-rec-open')
            if (open) {
              openRecordsPanel()
              fetchRecords()
            }
          })
          attachPanelDrag()
          recordsCloseEl.addEventListener('click', (e) => {
            e.stopPropagation()
            root.classList.remove('cgp-rec-open')
          })
          Array.prototype.forEach.call(rangeBtns, (b) => {
            b.addEventListener('click', () => {
              panel.range = b.getAttribute('data-range')
              Array.prototype.forEach.call(rangeBtns, (x) => x.classList.toggle('cgp-active', x === b))
              renderPanel()
            })
          })
          Array.prototype.forEach.call(scopeBtns, (b) => {
            b.addEventListener('click', () => {
              panel.scope = b.getAttribute('data-scope') === 'all' ? 'all' : 'session'
              Array.prototype.forEach.call(scopeBtns, (x) => x.classList.toggle('cgp-active', x === b))
              fetchRecords()
            })
          })
          Array.prototype.forEach.call(viewBtns, (b) => {
            b.addEventListener('click', () => {
              panel.view = b.getAttribute('data-view')
              Array.prototype.forEach.call(viewBtns, (x) => x.classList.toggle('cgp-active', x === b))
              renderPanel()
            })
          })
          prevBtnEl.addEventListener('click', () => { shiftPeriod(-1); renderPanel() })
          nextBtnEl.addEventListener('click', () => { shiftPeriod(1); renderPanel() })
          exportBtnEl.addEventListener('click', (e) => { e.stopPropagation(); doExport() })
          openBtnEl.addEventListener('click', (e) => { e.stopPropagation(); doOpen() })
          pickBtnEl.addEventListener('click', (e) => { e.stopPropagation(); doPickFolder() })
          clearPathBtnEl.addEventListener('click', (e) => { e.stopPropagation(); doClearFolder() })
          zeroBtnEl.addEventListener('click', (e) => {
            e.stopPropagation()
            if (zeroBtnEl.dataset.confirm !== '1') {
              zeroBtnEl.dataset.confirm = '1'
              zeroBtnEl.classList.add('cgp-confirming')
              zeroBtnEl.textContent = t('confirm')
              zeroBtnEl.title = t('confirmResetTip')
              clearTimeout(zeroTimer)
              zeroTimer = setTimeout(resetZeroButton, 2500)
              return
            }
            clearTimeout(zeroTimer)
            resetZeroButton()
            doReset()
          })
        }

        mountSkin(skinId)
        scheduleNarrowRecheck()
        poll()
        tick()
        bindPanel()
        resetZeroButton()
        refreshPrefs()
        const pollTimer = setInterval(poll, POLL_MS)
        const clockTimer = setInterval(tick, 1000)

        return () => {
          clearInterval(pollTimer)
          clearInterval(clockTimer)
          clearTimeout(toastTimer)
          clearTimeout(zeroTimer)
          clearTimeout(narrowRecheckTimer)
          window.removeEventListener('resize', onWindowResizePanel)
          window.removeEventListener('resize', onWindowResizeClamp)
          window.removeEventListener('resize', onWindowResizeYield)
          if (chatYieldTimer) clearTimeout(chatYieldTimer)
          if (narrowObserver) narrowObserver.disconnect()
          else window.removeEventListener('resize', scheduleNarrowRecheck)
          if (sideObserver) sideObserver.disconnect()
          if (frameAttrObserver) frameAttrObserver.disconnect()
          root.remove()
        }
      }, 'dsh-cost-gauge-plus: widget')
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
