export function renderPanelHtml(origin: string): string {
  const originJson = JSON.stringify(origin);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>地缘新闻控制面板</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    :root {
      --bg: #0f1419;
      --panel: #171d25;
      --line: #2a3441;
      --text: #e7ecf3;
      --muted: #93a0b0;
      --ok: #3ecf8e;
      --warn: #f0b429;
      --danger: #f07178;
      --accent: #3d9cf0;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "IBM Plex Sans", "Noto Sans SC", system-ui, sans-serif;
      background:
        radial-gradient(900px 500px at 10% -10%, #1c3a57 0%, transparent 55%),
        radial-gradient(700px 400px at 100% 0%, #243028 0%, transparent 50%),
        var(--bg);
      color: var(--text);
      min-height: 100vh;
    }
    .wrap { max-width: 1180px; margin: 0 auto; padding: 28px 18px 60px; }
    h1 { font-size: 1.55rem; margin: 0 0 6px; letter-spacing: 0.02em; }
    .sub { color: var(--muted); margin-bottom: 22px; font-size: 0.95rem; }
    .card {
      background: color-mix(in srgb, var(--panel) 92%, black);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 18px;
      margin-bottom: 16px;
    }
    .card h2 { margin: 0 0 12px; font-size: 1.05rem; }
    .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    input, button, select {
      font: inherit;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: #0c1117;
      color: var(--text);
      padding: 10px 12px;
    }
    input { flex: 1; min-width: 220px; }
    button {
      background: linear-gradient(180deg, #3f8fdc, #2f74b8);
      border: none;
      cursor: pointer;
      font-weight: 600;
    }
    button.ghost { background: transparent; border: 1px solid var(--line); font-weight: 500; }
    button.danger { background: linear-gradient(180deg, #c24b55, #9e343d); }
    button:disabled { opacity: 0.55; cursor: not-allowed; }
    .muted { color: var(--muted); font-size: 0.9rem; line-height: 1.5; }
    .steps { margin: 0; padding-left: 18px; color: var(--muted); }
    .steps li { margin: 6px 0; }
    .tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 0.75rem;
      border: 1px solid var(--line);
      color: var(--muted);
    }
    .tag.ok { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 50%, var(--line)); }
    .tag.warn { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 50%, var(--line)); }
    .tag.off { color: var(--danger); }
    table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
    th { color: var(--muted); font-weight: 500; }
    .actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .actions button { padding: 7px 10px; font-size: 0.85rem; }
    #toast {
      position: fixed; right: 16px; bottom: 16px; background: #122033; border: 1px solid var(--line);
      padding: 12px 14px; border-radius: 10px; display: none; max-width: 360px; z-index: 9999;
      white-space: pre-wrap;
    }
    #loginBox { max-width: 420px; margin: 12vh auto; }
    .hidden { display: none !important; }
    code { background: #0c1117; padding: 1px 6px; border-radius: 6px; }

    .sandbox {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.9fr);
      gap: 14px;
    }
    @media (max-width: 900px) {
      .sandbox { grid-template-columns: 1fr; }
    }
    #warMap {
      height: 460px;
      border-radius: 12px;
      border: 1px solid var(--line);
      overflow: hidden;
      background: #0b1016;
    }
    .outlook-side { display: flex; flex-direction: column; gap: 10px; min-height: 460px; }
    .metric {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px;
      background: #10161e;
    }
    .metric .label { color: var(--muted); font-size: 0.8rem; margin-bottom: 4px; }
    .metric .value { font-size: 1.25rem; font-weight: 700; }
    .metric .note { margin-top: 6px; color: var(--muted); font-size: 0.88rem; line-height: 1.45; }
    .risk-bar {
      height: 8px; border-radius: 99px; background: #243040; overflow: hidden; margin-top: 8px;
    }
    .risk-bar > i {
      display: block; height: 100%; border-radius: 99px;
      background: linear-gradient(90deg, #3ecf8e, #f0b429, #f07178);
    }
    .leaflet-container { background: #0b1016; font: inherit; }
    .leaflet-popup-content-wrapper, .leaflet-popup-tip {
      background: #121a24; color: var(--text); border: 1px solid var(--line);
    }
    .node-dot {
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.85);
      box-shadow: 0 0 0 4px rgba(0,0,0,0.25);
      flex-shrink: 0;
    }
    .node-label-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      pointer-events: auto;
    }
    .node-label-text {
      display: flex;
      flex-direction: column;
      line-height: 1.15;
      text-shadow: 0 1px 2px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.8);
    }
    .node-label-zh {
      color: #f3f7fc;
      font-size: 12px;
      font-weight: 700;
    }
    .node-label-en {
      color: #b7c4d4;
      font-size: 10px;
      font-weight: 500;
    }
    .node-label-wrap.focus .node-label-zh { color: #ffe08a; }
    .attack-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 6px 10px;
      padding: 8px 0;
      border-bottom: 1px solid var(--line);
      font-size: 0.88rem;
    }
    .attack-row:last-child { border-bottom: none; }
    .attack-row.hot { background: rgba(240, 113, 120, 0.08); margin: 0 -8px; padding-left: 8px; padding-right: 8px; border-radius: 8px; }
    .attack-name { font-weight: 650; }
    .attack-en { color: var(--muted); font-size: 0.78rem; font-weight: 500; }
    .attack-score { font-weight: 700; text-align: right; }
    .attack-meta { grid-column: 1 / -1; color: var(--muted); font-size: 0.82rem; line-height: 1.4; }
    .bias-pill {
      display: inline-block;
      min-width: 2.2em;
      text-align: center;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 700;
      border: 1px solid var(--line);
    }
    .bias-long { color: #3ecf8e; border-color: color-mix(in srgb, #3ecf8e 45%, var(--line)); }
    .bias-short { color: #f07178; border-color: color-mix(in srgb, #f07178 45%, var(--line)); }
    .bias-neutral { color: #f0b429; border-color: color-mix(in srgb, #f0b429 45%, var(--line)); }
  </style>
</head>
<body>
  <div class="wrap">
    <div id="loginBox" class="card">
      <h1>地缘新闻控制面板</h1>
      <p class="sub">登录后可管理机器人，并查看战争走向沙盘。</p>
      <div class="row">
        <input id="password" type="password" placeholder="面板密码" autocomplete="current-password" />
        <button type="button" id="loginBtn">登录</button>
      </div>
    </div>

    <div id="app" class="hidden">
      <div class="row" style="justify-content:space-between;margin-bottom:8px">
        <div>
          <h1>地缘新闻控制面板</h1>
          <p class="sub">美国 / 伊朗 / 迪拜 · Workers AI · Telegram · 战争沙盘</p>
        </div>
        <button type="button" class="ghost" id="logoutBtn">退出</button>
      </div>

      <div class="card">
        <div class="row" style="justify-content:space-between;margin-bottom:10px">
          <h2 style="margin:0">战争走向沙盘</h2>
          <div class="row">
            <button type="button" id="analyzeBtn">重新分析走向</button>
            <button type="button" class="ghost" id="refreshOutlookBtn">刷新</button>
          </div>
        </div>
        <p class="muted" style="margin-top:0">用 Cloudflare AI 综合近期新闻，评估升级/降温，以及迪拜等节点被波及风险。圆点颜色越红风险越高。</p>
        <div class="metric" style="margin-bottom:12px">
          <div class="label">怎么读「升级中 · 7/10」</div>
          <div class="note" style="color:var(--text)">
            <b>前半段是方向：</b>升级中 = 紧张在加重；僵持/观望 = 大体稳住；降温中 = 缓和迹象变多。<br>
            <b>后半段是强度（1–10）：</b>1–3 偏低；4–6 中等需关注；7–8 偏高；9–10 极高（接近大规模开战或已大幅升级）。<br>
            例如 <b>升级中 · 7/10</b> = 局势正在变紧张，严重程度约七成，还没到最高档。<br>
            <b>迪拜波及分</b>：航运/空域等被卷入程度；<b>攻击迪拜可能性</b>：伊朗（含代理）对其动手的概率，两者不同。<br>
            攻击可能性 1–10：1–3 很低；4–6 需盯；7–8 偏高；9–10 很高（仍是情报判断，非预言）。<br>
            <b>市场多空：</b>多=偏多，空=偏空，震=观望；旁为影响强度。仅情景参考，非投资建议。
          </div>
        </div>
        <div class="sandbox">
          <div id="warMap"></div>
          <div class="outlook-side">
            <div class="metric">
              <div class="label">战争走向（方向 · 强度/10）</div>
              <div class="value" id="trajValue">—</div>
              <div class="note" id="trajHint" style="margin-bottom:6px;color:#b7c4d4">升级中=加重 · 僵持=观望 · 降温中=缓和；分数越高越危险</div>
              <div class="note" id="trajNote">点击「重新分析走向」生成首份沙盘</div>
              <div class="risk-bar"><i id="trajBar" style="width:0%"></i></div>
            </div>
            <div class="metric">
              <div class="label">迪拜波及风险（被卷入程度/10）</div>
              <div class="value" id="dubaiValue">—</div>
              <div class="note" id="dubaiNote">重点观察航运、空域、保险与避险资金</div>
              <div class="risk-bar"><i id="dubaiBar" style="width:0%"></i></div>
            </div>
            <div class="metric">
              <div class="label">伊朗攻击迪拜可能性（动手概率/10）</div>
              <div class="value" id="dubaiAttackValue">—</div>
              <div class="note" id="dubaiAttackNote">含直接打击或经代理胁迫；点击下方列表看周边国家</div>
              <div class="risk-bar"><i id="dubaiAttackBar" style="width:0%"></i></div>
            </div>
            <div class="metric" style="flex:1">
              <div class="label">伊朗攻击周边可能性预测</div>
              <div class="note" style="margin-bottom:8px">按可能性从高到低；near≈约2周，mid≈1–3个月</div>
              <div id="attackList"><p class="muted">点击「重新分析走向」生成预测</p></div>
              <div class="label" style="margin-top:14px">经济 / 股市 / 加密货币影响</div>
              <div class="note" id="marketSummary" style="color:var(--text);margin-bottom:8px">暂无分析</div>
              <div class="note" style="margin-bottom:8px">影响度越高越敏感；多=偏多，空=偏空，震=观望。仅供情景参考，非投资建议。</div>
              <div id="marketList"><p class="muted">点击「重新分析走向」生成多空判断</p></div>
              <div class="label" style="margin-top:12px">AI 总览</div>
              <div class="note" id="summaryNote" style="color:var(--text)">暂无分析</div>
              <div class="label" style="margin-top:12px">可能情景</div>
              <ul class="steps" id="scenarioList"><li class="muted">—</li></ul>
              <div class="label" style="margin-top:8px">观察点</div>
              <ul class="steps" id="watchList"><li class="muted">—</li></ul>
              <p class="muted" id="outlookMeta" style="margin-top:10px"></p>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>① 添加 Telegram 机器人</h2>
        <p class="muted">在 @BotFather 创建 bot，复制 Token。系统会自动配置 Webhook。</p>
        <div class="row">
          <input id="botToken" placeholder="123456:AA..." />
          <button type="button" id="addBotBtn">添加并启用</button>
        </div>
      </div>

      <div class="card">
        <h2>② 把机器人拉进频道并设为管理员</h2>
        <ol class="steps">
          <li>频道设置 → 管理员 → 添加机器人</li>
          <li>勾选 <b>发布消息 / Post Messages</b></li>
          <li>保存后本页会自动出现已绑定频道</li>
        </ol>
        <div class="row" style="margin-top:8px">
          <select id="manualBot"></select>
          <input id="manualChat" placeholder="@your_channel 或 -100xxxxxxxxxx" />
          <button type="button" id="manualBindBtn">手动绑定</button>
        </div>
      </div>

      <div class="card">
        <h2>机器人</h2>
        <div id="botsTable"></div>
      </div>

      <div class="card">
        <h2>已绑定频道</h2>
        <div id="channelsTable"></div>
      </div>

      <div class="card">
        <h2>运行</h2>
        <div class="row">
          <button type="button" id="runNowBtn">立即抓取并推送</button>
          <button type="button" class="ghost" id="refreshBtn">刷新状态</button>
        </div>
        <p class="muted" id="runHint" style="margin-top:10px"></p>
      </div>

      <div class="card">
        <h2>最近事件</h2>
        <div id="events"></div>
      </div>
    </div>
  </div>
  <div id="toast"></div>
  <script>
    const origin = ${originJson};
    var map = null;
    var layerGroup = null;

    async function api(path, opts) {
      opts = opts || {};
      const res = await fetch(origin + path, {
        credentials: "include",
        headers: Object.assign({ "content-type": "application/json" }, opts.headers || {}),
        method: opts.method || "GET",
        body: opts.body
      });
      const data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
      return data;
    }

    function toast(msg) {
      var el = document.getElementById("toast");
      el.textContent = msg;
      el.style.display = "block";
      setTimeout(function () { el.style.display = "none"; }, 4000);
    }

    function esc(s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function tag(status) {
      if (status === "bound") return '<span class="tag ok">已绑定</span>';
      if (status === "pending") return '<span class="tag warn">待设管理员</span>';
      if (status === "left") return '<span class="tag off">已离开</span>';
      return '<span class="tag">' + esc(status) + '</span>';
    }

    function riskColor(risk) {
      var r = Number(risk) || 0;
      if (r >= 8) return "#f07178";
      if (r >= 6) return "#f0b429";
      if (r >= 4) return "#3d9cf0";
      return "#3ecf8e";
    }

    function trajLabel(t, score) {
      var mapT = { escalating: "升级中", stable: "僵持/观望", deescalating: "降温中" };
      return (mapT[t] || t || "—") + " · " + (score || "—") + "/10";
    }

    function ensureMap() {
      if (map) {
        setTimeout(function () { map.invalidateSize(); }, 50);
        return;
      }
      map = L.map("warMap", { zoomControl: true, attributionControl: true }).setView([26.2, 52.5], 5);
      // Free dark basemap (no API key). Carto dark_all now requires a key.
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 12,
          attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
        },
      ).addTo(map);
      layerGroup = L.layerGroup().addTo(map);
    }

    var NODE_LABELS = {
      iran: { zh: "伊朗", en: "Iran" },
      tehran: { zh: "德黑兰", en: "Tehran" },
      dubai: { zh: "迪拜", en: "Dubai" },
      uae: { zh: "阿联酋", en: "UAE" },
      abu_dhabi: { zh: "阿布扎比", en: "Abu Dhabi" },
      saudi: { zh: "沙特", en: "Saudi Arabia" },
      qatar: { zh: "卡塔尔", en: "Qatar" },
      bahrain: { zh: "巴林", en: "Bahrain" },
      iraq: { zh: "伊拉克", en: "Iraq" },
      israel: { zh: "以色列", en: "Israel" },
      yemen: { zh: "也门/胡塞", en: "Yemen / Houthis" },
      hormuz: { zh: "霍尔木兹海峡", en: "Strait of Hormuz" },
      red_sea: { zh: "红海航道", en: "Red Sea Lane" },
      persian_gulf: { zh: "波斯湾", en: "Persian Gulf" },
      us_5th_fleet: { zh: "美军第五舰队", en: "US 5th Fleet" },
      us: { zh: "美国(决策)", en: "United States" }
    };

    function bilingualName(n) {
      var pack = NODE_LABELS[n.id] || {};
      var zh = n.name || pack.zh || n.id;
      var en = n.name_en || pack.en || "";
      return { zh: zh, en: en };
    }

    function renderMap(nodes) {
      ensureMap();
      layerGroup.clearLayers();
      (nodes || []).forEach(function (n) {
        if (n.id === "us") return; // keep map focused on Gulf theater
        var names = bilingualName(n);
        var color = riskColor(n.risk);
        var size = n.focus ? 16 : (n.kind === "chokepoint" ? 14 : 12);
        var focusClass = n.focus ? " focus" : "";
        var html =
          '<div class="node-label-wrap' + focusClass + '">' +
            '<div class="node-dot" style="width:' + size + 'px;height:' + size + 'px;background:' + color + '"></div>' +
            '<div class="node-label-text">' +
              '<span class="node-label-zh">' + esc(names.zh) + '</span>' +
              (names.en ? '<span class="node-label-en">' + esc(names.en) + '</span>' : '') +
            '</div>' +
          '</div>';
        var icon = L.divIcon({
          className: "",
          html: html,
          iconSize: [150, 28],
          iconAnchor: [size / 2, 14]
        });
        var marker = L.marker([n.lat, n.lon], { icon: icon, zIndexOffset: n.focus ? 500 : 0 });
        marker.bindPopup(
          "<b>" + esc(names.zh) + (names.en ? " / " + esc(names.en) : "") + "</b><br>风险 " +
          esc(n.risk) + "/10<br>" + esc(n.why)
        );
        if (n.focus) {
          L.circle([n.lat, n.lon], {
            radius: 120000,
            color: color,
            fillColor: color,
            fillOpacity: 0.12,
            weight: 1
          }).addTo(layerGroup);
        }
        marker.addTo(layerGroup);
      });
    }

    function modeLabel(mode) {
      var m = String(mode || "");
      if (/missile|drone/i.test(m)) return "导弹/无人机";
      if (/proxy/i.test(m)) return "代理武装";
      if (/cyber/i.test(m)) return "网络攻击";
      if (/blockade/i.test(m)) return "封锁/航道胁迫";
      if (/coercion/i.test(m)) return "胁迫施压";
      if (/unlikely/i.test(m)) return "暂不明显";
      return m || "未标明";
    }

    function renderAttackList(list) {
      var el = document.getElementById("attackList");
      if (!list || !list.length) {
        el.innerHTML = '<p class="muted">暂无预测，请重新分析</p>';
        return;
      }
      el.innerHTML = list.map(function (a) {
        var hot = a.id === "dubai" || a.id === "uae" || (a.probability || 0) >= 7;
        var hz = a.horizon === "mid" ? "中期" : "近期";
        return '<div class="attack-row' + (hot ? " hot" : "") + '">' +
          '<div><div class="attack-name">' + esc(a.name) +
          ' <span class="attack-en">/ ' + esc(a.name_en || "") + "</span></div></div>" +
          '<div class="attack-score" style="color:' + riskColor(a.probability) + '">' +
          esc(a.probability) + "/10</div>" +
          '<div class="attack-meta">' + hz + " · " + esc(modeLabel(a.mode)) + " · " + esc(a.why) + "</div>" +
          "</div>";
      }).join("");
    }

    function biasLabel(bias) {
      if (bias === "long") return { text: "多", cls: "bias-long" };
      if (bias === "short") return { text: "空", cls: "bias-short" };
      return { text: "震", cls: "bias-neutral" };
    }

    function renderMarketList(list) {
      var el = document.getElementById("marketList");
      if (!list || !list.length) {
        el.innerHTML = '<p class="muted">暂无市场判断，请重新分析</p>';
        return;
      }
      el.innerHTML = list.map(function (m) {
        var b = biasLabel(m.bias);
        var hot = (m.impact || 0) >= 7;
        return '<div class="attack-row' + (hot ? " hot" : "") + '">' +
          '<div><div class="attack-name">' + esc(m.name) +
          ' <span class="attack-en">/ ' + esc(m.name_en || "") + "</span></div></div>" +
          '<div class="attack-score">' +
            '<span class="bias-pill ' + b.cls + '">' + b.text + "</span> " +
            '<span style="color:' + riskColor(m.impact) + '">影响' + esc(m.impact) + "/10</span>" +
          "</div>" +
          '<div class="attack-meta">把握' + esc(m.confidence) + "/10 · " + esc(m.why) + "</div>" +
          "</div>";
      }).join("");
    }

    function renderOutlook(o) {
      if (!o) {
        document.getElementById("trajValue").textContent = "—";
        document.getElementById("trajNote").textContent = "尚无分析，点击「重新分析走向」";
        document.getElementById("trajBar").style.width = "0%";
        document.getElementById("dubaiValue").textContent = "—";
        document.getElementById("dubaiBar").style.width = "0%";
        document.getElementById("dubaiAttackValue").textContent = "—";
        document.getElementById("dubaiAttackBar").style.width = "0%";
        document.getElementById("attackList").innerHTML = '<p class="muted">点击「重新分析走向」生成预测</p>';
        document.getElementById("marketSummary").textContent = "暂无分析";
        document.getElementById("marketList").innerHTML = '<p class="muted">点击「重新分析走向」生成多空判断</p>';
        return;
      }
      document.getElementById("trajValue").textContent = trajLabel(o.trajectory, o.trajectory_score);
      document.getElementById("trajNote").textContent = o.summary_zh || "";
      document.getElementById("trajBar").style.width = Math.min(100, (o.trajectory_score || 0) * 10) + "%";
      document.getElementById("dubaiValue").textContent = (o.dubai_risk || "—") + "/10";
      document.getElementById("dubaiNote").textContent = o.dubai_note || "";
      document.getElementById("dubaiBar").style.width = Math.min(100, (o.dubai_risk || 0) * 10) + "%";
      var dap = o.dubai_attack_probability;
      if (dap == null && o.attack_predictions) {
        var d = (o.attack_predictions || []).find(function (x) { return x.id === "dubai"; });
        dap = d ? d.probability : null;
      }
      document.getElementById("dubaiAttackValue").textContent = dap != null ? dap + "/10" : "—";
      document.getElementById("dubaiAttackNote").textContent = o.dubai_attack_note || "—";
      document.getElementById("dubaiAttackBar").style.width = Math.min(100, (dap || 0) * 10) + "%";
      renderAttackList(o.attack_predictions || []);
      document.getElementById("marketSummary").textContent = o.market_summary_zh || "暂无市场总览";
      renderMarketList(o.market_views || []);
      document.getElementById("summaryNote").textContent = o.summary_zh || "";
      document.getElementById("scenarioList").innerHTML = (o.scenarios || []).map(function (s) {
        return "<li>" + esc(s) + "</li>";
      }).join("") || "<li>—</li>";
      document.getElementById("watchList").innerHTML = (o.watchpoints || []).map(function (s) {
        return "<li>" + esc(s) + "</li>";
      }).join("") || "<li>—</li>";
      document.getElementById("outlookMeta").textContent =
        "基于 " + (o.based_on || 0) + " 条新闻 · 更新于 " + (o.created_at || "") +
        " · 攻击/多空为情景判断，非投资建议或确定性预言";
      renderMap(o.nodes || []);
    }

    function renderBots(bots) {
      if (!bots.length) return '<p class="muted">还没有机器人</p>';
      var rows = bots.map(function (b) {
        return '<tr><td><b>@' + esc(b.username || "unknown") + '</b><br><span class="muted">' + esc(b.first_name || "") +
          '</span></td><td>' + (b.enabled ? '<span class="tag ok">启用</span>' : '<span class="tag off">停用</span>') +
          '</td><td class="actions">' +
          '<button type="button" class="ghost" data-act="toggle-bot" data-id="' + esc(b.id) + '" data-on="' + (b.enabled ? 0 : 1) + '">' + (b.enabled ? "停用" : "启用") + '</button>' +
          '<button type="button" class="danger" data-act="del-bot" data-id="' + esc(b.id) + '">删除</button></td></tr>';
      }).join("");
      return '<table><thead><tr><th>机器人</th><th>状态</th><th>操作</th></tr></thead><tbody>' + rows + "</tbody></table>";
    }

    function renderChannels(channels) {
      if (!channels.length) return '<p class="muted">暂无绑定频道</p>';
      var rows = channels.map(function (c) {
        var name = c.username ? ("@" + c.username) : c.chat_id;
        return '<tr><td><b>' + esc(c.title || c.chat_id) + '</b><br><span class="muted">' + esc(name) +
          '</span></td><td>@' + esc(c.bot_username || "?") + '</td><td>' + tag(c.status) +
          (c.enabled ? "" : ' <span class="tag off">停用</span>') +
          '</td><td class="actions">' +
          '<button type="button" class="ghost" data-act="test" data-id="' + esc(c.id) + '">测试发送</button>' +
          '<button type="button" class="ghost" data-act="toggle-ch" data-id="' + esc(c.id) + '" data-on="' + (c.enabled ? 0 : 1) + '">' + (c.enabled ? "停用" : "启用") + '</button>' +
          '<button type="button" class="danger" data-act="del-ch" data-id="' + esc(c.id) + '">移除</button></td></tr>';
      }).join("");
      return '<table><thead><tr><th>频道</th><th>机器人</th><th>状态</th><th>操作</th></tr></thead><tbody>' + rows + "</tbody></table>";
    }

    async function refresh() {
      var data = await api("/api/status");
      var bots = data.bots || [];
      var channels = data.channels || [];
      var events = data.events || [];
      var botSelect = document.getElementById("manualBot");
      botSelect.innerHTML = bots.length
        ? bots.map(function (b) { return '<option value="' + esc(b.id) + '">@' + esc(b.username || b.id) + "</option>"; }).join("")
        : '<option value="">请先添加机器人</option>';
      document.getElementById("botsTable").innerHTML = renderBots(bots);
      document.getElementById("channelsTable").innerHTML = renderChannels(channels);
      document.getElementById("events").innerHTML = events.length
        ? '<ul class="steps">' + events.map(function (e) {
            return "<li>[" + esc(e.created_at) + "] " + esc(e.message) + "</li>";
          }).join("") + "</ul>"
        : '<p class="muted">暂无事件</p>';
      document.getElementById("runHint").textContent =
        "活跃推送目标: " + (data.activeTargets || 0) + " 个频道 · 最近发送: " + (data.recentSent || 0) + " 条";
      renderOutlook(data.outlook || null);
    }

    async function showApp() {
      document.getElementById("loginBox").classList.add("hidden");
      document.getElementById("app").classList.remove("hidden");
      await refresh();
      ensureMap();
    }

    async function doLogin() {
      var pwd = document.getElementById("password").value.trim();
      if (!pwd) { toast("请输入密码"); return; }
      try {
        document.getElementById("loginBtn").disabled = true;
        await api("/api/login", { method: "POST", body: JSON.stringify({ password: pwd }) });
        await showApp();
      } catch (e) { toast(e.message || "登录失败"); }
      finally { document.getElementById("loginBtn").disabled = false; }
    }

    document.getElementById("loginBtn").onclick = doLogin;
    document.getElementById("password").addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") doLogin();
    });
    document.getElementById("logoutBtn").onclick = async function () {
      await api("/api/logout", { method: "POST", body: "{}" });
      location.reload();
    };

    document.getElementById("analyzeBtn").onclick = async function () {
      try {
        document.getElementById("analyzeBtn").disabled = true;
        toast("正在用 Cloudflare AI 分析战争走向…");
        var data = await api("/api/outlook/analyze", { method: "POST", body: "{}" });
        renderOutlook(data.outlook);
        toast("沙盘已更新");
      } catch (e) { toast(e.message); }
      finally { document.getElementById("analyzeBtn").disabled = false; }
    };
    document.getElementById("refreshOutlookBtn").onclick = async function () {
      try {
        var data = await api("/api/outlook");
        renderOutlook(data.outlook || null);
      } catch (e) { toast(e.message); }
    };

    document.getElementById("addBotBtn").onclick = async function () {
      try {
        await api("/api/bots", { method: "POST", body: JSON.stringify({ token: document.getElementById("botToken").value.trim() }) });
        document.getElementById("botToken").value = "";
        toast("机器人已添加");
        await refresh();
      } catch (e) { toast(e.message); }
    };
    document.getElementById("manualBindBtn").onclick = async function () {
      try {
        await api("/api/channels/bind", {
          method: "POST",
          body: JSON.stringify({
            bot_id: document.getElementById("manualBot").value,
            chat: document.getElementById("manualChat").value.trim()
          })
        });
        toast("绑定成功");
        document.getElementById("manualChat").value = "";
        await refresh();
      } catch (e) { toast(e.message); }
    };
    document.getElementById("runNowBtn").onclick = async function () {
      try {
        document.getElementById("runNowBtn").disabled = true;
        var data = await api("/api/run", { method: "POST", body: "{}" });
        toast("完成：发送 " + ((data.stats && data.stats.sent) || 0) + " 条");
        await refresh();
      } catch (e) { toast(e.message); }
      finally { document.getElementById("runNowBtn").disabled = false; }
    };
    document.getElementById("refreshBtn").onclick = function () {
      refresh().catch(function (e) { toast(e.message); });
    };

    document.body.addEventListener("click", async function (ev) {
      var btn = ev.target.closest("button[data-act]");
      if (!btn) return;
      var act = btn.getAttribute("data-act");
      var id = btn.getAttribute("data-id");
      try {
        if (act === "del-bot") {
          if (!confirm("删除该机器人及其频道绑定？")) return;
          await api("/api/bots/" + id, { method: "DELETE" });
        } else if (act === "toggle-bot") {
          await api("/api/bots/" + id, { method: "PATCH", body: JSON.stringify({ enabled: btn.getAttribute("data-on") === "1" }) });
        } else if (act === "del-ch") {
          await api("/api/channels/" + id, { method: "DELETE" });
        } else if (act === "toggle-ch") {
          await api("/api/channels/" + id, { method: "PATCH", body: JSON.stringify({ enabled: btn.getAttribute("data-on") === "1" }) });
        } else if (act === "test") {
          await api("/api/channels/" + id + "/test", { method: "POST", body: "{}" });
          toast("测试消息已发送");
        }
        await refresh();
      } catch (e) { toast(e.message); }
    });

    api("/api/status").then(showApp).catch(function () {});
    setInterval(function () {
      if (!document.getElementById("app").classList.contains("hidden")) {
        refresh().catch(function () {});
      }
    }, 20000);
  </script>
</body>
</html>`;
}
