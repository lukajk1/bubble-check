/* Bubble Check: a quiz about what the U.S. population actually believes, buys, watches and does.
   Answers live in questions.js (base64 so they don't spoil at a glance) and are never shown until the end. */
(() => {
  "use strict";

  // ---------- data ----------
  const DATA = (() => {
    const bin = atob(window.__BUBBLE_DATA__);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  })();
  const QS = DATA.questions;
  const BY_ID = Object.fromEntries(QS.map(q => [q.id, q]));
  const KEY = "bubblecheck";

  // ---------- persistence: localStorage, mirrored to a cookie ----------
  const blank = () => ({ idx: -1, answers: {}, finished: false, startedAt: null, finishedAt: null });

  function readCookie() {
    const m = document.cookie.match(/(?:^|;\s*)bubblecheck=([^;]*)/);
    return m ? decodeURIComponent(m[1]) : null;
  }
  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (_) {}
    if (!raw) raw = readCookie();
    if (!raw) return blank();
    try {
      const s = Object.assign(blank(), JSON.parse(raw));
      for (const id of Object.keys(s.answers)) if (!BY_ID[id]) delete s.answers[id];
      s.idx = Math.min(s.idx, QS.length - 1);
      return s;
    } catch (_) { return blank(); }
  }
  function save() {
    const raw = JSON.stringify(state);
    try { localStorage.setItem(KEY, raw); } catch (_) {}
    try { document.cookie = `${KEY}=${encodeURIComponent(raw)}; max-age=31536000; path=/; SameSite=Lax`; } catch (_) {}
  }
  function wipe() {
    try { localStorage.removeItem(KEY); } catch (_) {}
    document.cookie = `${KEY}=; max-age=0; path=/; SameSite=Lax`;
  }

  let state = load();

  // ---------- helpers ----------
  const $app = document.getElementById("app");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content; };

  function hash(str) { let x = 2166136261; for (const c of str) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619); } return x >>> 0; }
  function rng(seed) { return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // True order: indices of items sorted top-to-bottom (highest value first unless ascending).
  function trueOrder(q) {
    const idx = q.items.map((_, i) => i);
    return idx.sort((a, b) => q.rankAscending ? q.items[a].value - q.items[b].value : q.items[b].value - q.items[a].value);
  }
  // Starting order shown to the player: a fixed shuffle that carries no hint, so neither the
  // true order nor its reverse (2–4 of the 6 pairs correct).
  function startOrder(q) {
    for (let k = 0; ; k++) {
      const r = rng(hash(q.id) + k), a = q.items.map((_, i) => i);
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      const ok = pairsRight(q, a);
      if ((ok >= 2 && ok <= 4) || k > 50) return a;
    }
  }
  function pairsRight(q, a) {
    const sign = q.rankAscending ? -1 : 1;
    let ok = 0;
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++)
      if (sign * (q.items[a[i]].value - q.items[a[j]].value) >= 0) ok++;
    return ok;
  }

  function numRange(q) {
    if (q.type === "number") return { min: q.min, max: q.max, step: q.step || 1 };
    return { min: 0, max: 100, step: 1 };
  }
  const fmt = (q, v) => {
    if (v == null) return "—";
    const { step } = numRange(q);
    const dec = step < 1 ? String(step).split(".")[1].length : 0;
    const n = Number(v).toFixed(dec);
    return q.unit === "%" ? `${n}%` : `${n}${q.unit ? " " + q.unit : ""}`;
  };

  // ---------- scoring (each question worth 1 point) ----------
  function score(q, a) {
    if (a == null) return { pts: 0, note: "No answer" };
    if (q.type === "bins") return { pts: a === q.answerBin ? 1 : 0 };
    if (q.type === "rank") {
      const ok = pairsRight(q, a), n = (a.length * (a.length - 1)) / 2;
      const exact = a.join() === trueOrder(q).join();
      return { pts: exact ? 1 : ok / n, note: exact ? "Perfect order" : `${ok} of ${n} pairs in the right order` };
    }
    // percent / number: full credit within 3% of the range, nothing beyond 25%.
    const { min, max } = numRange(q);
    const span = max - min, err = Math.abs(a - q.answer);
    const pts = Math.max(0, Math.min(1, 1 - (err - 0.03 * span) / (0.22 * span)));
    const off = q.unit === "%" ? `${+err.toFixed(1)} percentage point${err === 1 ? "" : "s"}` : fmt(q, err);
    return { pts, err, note: err === 0 ? "Exactly right" : `Off by ${off}` };
  }

  // ---------- screens ----------
  function render() {
    if (state.finished) return renderResults();
    if (state.idx < 0) return renderIntro();
    renderQuestion(QS[state.idx]);
  }

  function renderIntro() {
    const cats = [...new Set(QS.map(q => q.category))];
    const answered = Object.keys(state.answers).length;
    $app.replaceChildren(h(`
      <section class="card">
        <h1>How well do you know America?</h1>
        <p class="lede">Not your feed, not your friends: the whole country. ${QS.length} questions on what Americans actually believe, know, buy, watch and do, all checked against recent surveys and market data.</p>
        <ul class="intro-points">
          <li>About 10 minutes. Rank things, pick a range, or slide to a percentage.</li>
          <li>No feedback until the end, so your guesses can't learn from each other.</li>
          <li>Your progress is saved in this browser, so reloading is safe.</li>
          <li>At the end: your score, a breakdown of every answer, and the source behind each one.</li>
        </ul>
        <div class="cats">${cats.map(c => `<span class="chip">${esc(c)}</span>`).join("")}</div>
        <div class="row">
          <button class="btn accent" id="start">${answered ? `Continue (${answered}/${QS.length} answered)` : "Start the quiz"}</button>
        </div>
      </section>`));
    document.getElementById("start").onclick = () => {
      if (!state.startedAt) state.startedAt = Date.now();
      state.idx = answered ? Math.min(firstUnanswered(), QS.length - 1) : 0;
      save(); render();
    };
  }
  const firstUnanswered = () => { const i = QS.findIndex(q => state.answers[q.id] == null); return i < 0 ? QS.length - 1 : i; };

  function renderQuestion(q) {
    const i = state.idx, last = i === QS.length - 1;
    const answeredCount = Object.keys(state.answers).length;
    const hint = {
      rank: `Drag the items, or use the arrows. Top = ${esc((q.rankLabel || "highest → lowest").split("→")[0].trim().toLowerCase())}.`,
      bins: "Pick one range.",
      percent: "Drag the slider or type a number.",
      number: `Drag the slider or type a number (${esc(fmt(q, q.min))} to ${esc(fmt(q, q.max))}).`,
    }[q.type];

    $app.replaceChildren(h(`
      <div class="progress"><div class="bar"><span style="width:${(answeredCount / QS.length) * 100}%"></span></div>
        <span class="count">${i + 1} / ${QS.length}</span></div>
      <section class="card">
        <span class="chip">${esc(q.category)}</span>
        <p class="q-prompt">${esc(q.prompt)}</p>
        <p class="q-hint">${hint}</p>
        <div id="input"></div>
        <div class="q-nav">
          <button class="ghost" id="back" ${i === 0 ? "disabled" : ""}>Back</button>
          <button class="btn ${last ? "accent" : ""}" id="next">${last ? "Finish and see results" : "Next"}</button>
        </div>
      </section>`));

    const input = document.getElementById("input");
    const next = document.getElementById("next");
    const setNextEnabled = () => { next.disabled = state.answers[q.id] == null; };

    if (q.type === "bins") buildBins(q, input, setNextEnabled);
    else if (q.type === "rank") buildRank(q, input, setNextEnabled);
    else buildSlider(q, input, setNextEnabled);
    setNextEnabled();

    document.getElementById("back").onclick = () => { state.idx = Math.max(0, i - 1); save(); render(); };
    next.onclick = () => {
      if (state.answers[q.id] == null) return;
      if (last) {
        const missing = QS.filter(x => state.answers[x.id] == null);
        if (missing.length) { state.idx = QS.indexOf(missing[0]); save(); return render(); }
        state.finished = true; state.finishedAt = Date.now();
      } else state.idx = i + 1;
      save(); render(); window.scrollTo({ top: 0 });
    };
  }

  function buildBins(q, el, done) {
    el.replaceChildren(h(`<div class="bins">${q.bins.map((b, k) =>
      `<button class="bin" data-k="${k}" aria-pressed="${state.answers[q.id] === k}">${esc(b)}</button>`).join("")}</div>`));
    el.querySelectorAll(".bin").forEach(btn => btn.onclick = () => {
      state.answers[q.id] = +btn.dataset.k; save();
      el.querySelectorAll(".bin").forEach(b => b.setAttribute("aria-pressed", b === btn));
      done();
    });
  }

  function buildSlider(q, el, done) {
    const { min, max, step } = numRange(q);
    const cur = state.answers[q.id];
    el.replaceChildren(h(`
      <div class="slider-box ${cur == null ? "is-unset" : ""}">
        <div class="big-num ${cur == null ? "unset" : ""}" id="bn">${cur == null ? "Move the slider to answer" : esc(fmt(q, cur))}</div>
        <input type="range" id="rg" min="${min}" max="${max}" step="${step}" value="${cur ?? (min + max) / 2}" aria-label="Your estimate">
        <div class="range-ends"><span>${esc(fmt(q, min))}</span><span>${esc(fmt(q, max))}</span></div>
        <label class="num-entry">or type it <input type="number" id="nb" min="${min}" max="${max}" step="${step}" value="${cur ?? ""}" inputmode="decimal"></label>
      </div>`));
    const rg = el.querySelector("#rg"), nb = el.querySelector("#nb"), bn = el.querySelector("#bn");
    const set = (v, from) => {
      if (v === "" || isNaN(v)) return;
      v = Math.min(max, Math.max(min, Number(v)));
      v = Math.round(v / step) * step; v = +v.toFixed(4);
      state.answers[q.id] = v; save();
      bn.textContent = fmt(q, v); bn.classList.remove("unset");
      el.querySelector(".slider-box").classList.remove("is-unset");
      if (from !== "rg") rg.value = v;
      if (from !== "nb") nb.value = v;
      done();
    };
    rg.addEventListener("input", () => set(rg.value, "rg"));
    rg.addEventListener("change", () => set(rg.value, "rg")); // a click on the exact midpoint fires no input event
    nb.addEventListener("input", () => set(nb.value, "nb"));
  }

  function buildRank(q, el, done) {
    if (state.answers[q.id] == null) { state.answers[q.id] = startOrder(q); }
    let order = state.answers[q.id].slice();
    const [top, bottom] = (q.rankLabel || "Highest → Lowest").split("→").map(s => s.trim());
    el.replaceChildren(h(`
      <div class="rank-end">▲ ${esc(top)}</div>
      <ol class="rank-list" id="rl"></ol>
      <div class="rank-end">▼ ${esc(bottom)}</div>`));
    const list = el.querySelector("#rl");
    const commit = () => { state.answers[q.id] = order.slice(); save(); done(); };

    function draw() {
      list.replaceChildren(...order.map((itemIdx, pos) => {
        const li = document.createElement("li");
        li.className = "rank-item"; li.dataset.pos = pos;
        li.innerHTML = `<span class="grip" aria-hidden="true">⋮⋮</span><span class="rank-num">${pos + 1}</span>
          <span class="rank-label">${esc(q.items[itemIdx].label)}</span>
          <button class="mv" data-d="-1" aria-label="Move up" ${pos === 0 ? "disabled" : ""}>▲</button>
          <button class="mv" data-d="1" aria-label="Move down" ${pos === order.length - 1 ? "disabled" : ""}>▼</button>`;
        li.querySelectorAll(".mv").forEach(b => b.onclick = () => {
          const to = pos + +b.dataset.d;
          [order[pos], order[to]] = [order[to], order[pos]];
          commit(); draw();
          list.children[to].querySelector(`.mv[data-d="${b.dataset.d}"]`)?.focus();
        });
        li.addEventListener("pointerdown", e => startDrag(e, li));
        return li;
      }));
    }

    function startDrag(e, li) {
      if (e.target.closest(".mv") || e.button > 0) return;
      e.preventDefault();
      let pos = +li.dataset.pos;
      const items = [...list.children];
      const rects = items.map(n => n.getBoundingClientRect());
      const slot = rects[1] ? rects[1].top - rects[0].top : rects[0].height + 8;
      const startY = e.clientY;
      li.classList.add("dragging");
      li.setPointerCapture(e.pointerId);
      const origin = pos;

      const move = ev => {
        const dy = ev.clientY - startY;
        li.style.transform = `translateY(${dy}px)`;
        const target = Math.max(0, Math.min(order.length - 1, Math.round(origin + dy / slot)));
        if (target !== pos) {
          // shift the other items visually
          items.forEach((n, k) => {
            if (n === li) return;
            let shift = 0;
            if (origin < target && k > origin && k <= target) shift = -slot;
            if (origin > target && k < origin && k >= target) shift = slot;
            n.style.transition = "transform .15s"; n.style.transform = shift ? `translateY(${shift}px)` : "";
          });
          pos = target;
        }
      };
      const up = () => {
        li.removeEventListener("pointermove", move);
        li.removeEventListener("pointerup", up);
        li.removeEventListener("pointercancel", up);
        if (pos !== origin) { const [m] = order.splice(origin, 1); order.splice(pos, 0, m); }
        commit(); draw();
      };
      li.addEventListener("pointermove", move);
      li.addEventListener("pointerup", up);
      li.addEventListener("pointercancel", up);
    }

    draw();
    commit(); // the shown order counts as an answer; the player can accept it as-is
  }

  // ---------- results ----------
  const VERDICTS = [
    [90, "Census-grade. You see the country as it is."],
    [78, "Well calibrated. A few blind spots, nothing major."],
    [64, "Decent map, some fog. Your bubble shows in places."],
    [50, "Your bubble is doing a lot of the talking."],
    [0, "Deep in the bubble. The country looks quite different from out here."],
  ];

  function renderResults() {
    const rows = QS.map(q => ({ q, a: state.answers[q.id], s: score(q, state.answers[q.id]) }));
    const total = rows.reduce((t, r) => t + r.s.pts, 0);
    const pct = Math.round((total / QS.length) * 100);
    const verdict = VERDICTS.find(([min]) => pct >= min)[1];

    // calibration on numeric guesses
    const signed = rows.filter(r => r.q.type === "percent" && r.a != null).map(r => r.a - r.q.answer);
    const meanSigned = signed.length ? signed.reduce((a, b) => a + b, 0) / signed.length : 0;
    const meanAbs = signed.length ? signed.reduce((a, b) => a + Math.abs(b), 0) / signed.length : 0;
    const exact = rows.filter(r => r.s.pts >= 0.999).length;
    const mins = state.startedAt && state.finishedAt ? Math.max(1, Math.round((state.finishedAt - state.startedAt) / 60000)) : null;

    const cats = [...new Set(QS.map(q => q.category))].map(c => {
      const rs = rows.filter(r => r.q.category === c);
      return { c, pct: Math.round(rs.reduce((t, r) => t + r.s.pts, 0) / rs.length * 100), n: rs.length };
    });

    // numbered references, in question order
    const refs = [];
    const refNum = src => {
      let k = refs.findIndex(r => r.url === src.url);
      if (k < 0) { refs.push(src); k = refs.length - 1; }
      return k + 1;
    };
    rows.forEach(r => { r.refs = [r.q.source, ...(r.q.extraSources || [])].filter(Boolean).map(refNum); });

    $app.replaceChildren(h(`
      <section class="card score-hero">
        <div class="muted small">Your Bubble Check score</div>
        <div class="score-big">${pct}<small>/100</small></div>
        <div class="verdict">${esc(verdict)}</div>
        <div class="stats">
          <div class="stat"><b>${exact} / ${QS.length}</b><span>questions fully right</span></div>
          ${signed.length ? `<div class="stat"><b>${meanAbs.toFixed(1)} pts</b><span>average miss on percentage guesses (in percentage points)</span></div>
          <div class="stat"><b>${meanSigned > 0 ? "+" : ""}${meanSigned.toFixed(1)} pts</b><span>${Math.abs(meanSigned) < 2 ? "no real lean: you neither over- nor underestimate" : meanSigned > 0 ? "you tend to overestimate percentages" : "you tend to underestimate percentages"}</span></div>` : ""}
          ${mins ? `<div class="stat"><b>${mins} min</b><span>time taken</span></div>` : ""}
        </div>
        <div class="row" style="justify-content:center;margin-top:22px">
          <button class="ghost" id="again">Retake from scratch</button>
        </div>
      </section>

      <h2 class="section-title">By topic</h2>
      <section class="card"><div class="catbars">${cats.map(x => `
        <div class="catbar"><span>${esc(x.c)}</span><div class="bar"><span style="width:${x.pct}%"></span></div><span class="pct">${x.pct}%</span></div>`).join("")}
      </div></section>

      <h2 class="section-title">Every answer</h2>
      <div class="filters" id="filters">
        <button class="ghost small" data-f="all" aria-pressed="true">All</button>
        <button class="ghost small" data-f="miss" aria-pressed="false">Biggest misses first</button>
        ${cats.map(x => `<button class="ghost small" data-f="cat:${esc(x.c)}" aria-pressed="false">${esc(x.c)}</button>`).join("")}
      </div>
      <div class="review" id="review"></div>

      <h2 class="section-title">Sources</h2>
      <section class="card"><ol class="refs">${refs.map(s => `
        <li id="ref-${refs.indexOf(s) + 1}">${esc(s.publisher)}, <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>${s.published ? ` (${esc(s.published)})` : ""}${s.fieldwork ? `. Data: ${esc(s.fieldwork)}` : ""}.</li>`).join("")}
      </ol></section>`));

    const review = document.getElementById("review");
    const drawReview = f => {
      let list = rows.map((r, k) => ({ ...r, k }));
      if (f === "miss") list.sort((a, b) => a.s.pts - b.s.pts);
      else if (f.startsWith("cat:")) list = list.filter(r => r.q.category === f.slice(4));
      review.replaceChildren(...list.map(reviewCard));
    };
    document.getElementById("filters").onclick = e => {
      const b = e.target.closest("button"); if (!b) return;
      document.querySelectorAll("#filters button").forEach(x => x.setAttribute("aria-pressed", x === b));
      drawReview(b.dataset.f);
    };
    drawReview("all");
    document.getElementById("again").onclick = askReset;
  }

  function reviewCard({ q, a, s, k, refs }) {
    const p = s.pts, cls = p >= 0.85 ? "good" : p >= 0.4 ? "mid" : "bad";
    let body = "";
    if (q.type === "rank") {
      const truth = trueOrder(q);
      body = `<div class="cmp">
        <div><h4>Your order</h4><ol>${(a || []).map((ix, pos) => `<li class="${truth[pos] === ix ? "ok" : "no"}">${esc(q.items[ix].label)}</li>`).join("")}</ol></div>
        <div><h4>Actual order</h4><ol>${truth.map(ix => `<li>${esc(q.items[ix].label)} <span class="val">${esc(q.items[ix].display || q.items[ix].value)}</span></li>`).join("")}</ol></div>
      </div>`;
    } else if (q.type === "bins") {
      const right = a === q.answerBin;
      body = `<p class="answer-line">You picked <b class="${right ? "ok" : "no"}">${esc(q.bins[a] ?? "nothing")}</b>.
        ${right ? "" : `The answer was <b>${esc(q.bins[q.answerBin])}</b>.`}
        Actual figure: <b>${esc(fmt(q, q.answer))}</b>.</p>`;
    } else {
      const { min, max } = numRange(q), at = v => ((v - min) / (max - min)) * 100;
      const lo = Math.min(at(a), at(q.answer)), hi = Math.max(at(a), at(q.answer));
      body = `<p class="answer-line">You said <b>${esc(fmt(q, a))}</b>. Actual: <b>${esc(fmt(q, q.answer))}</b>.</p>
        <div class="numline"><div class="track"></div><div class="gap" style="left:${lo}%;width:${hi - lo}%"></div>
          <div class="mk truth" style="left:${at(q.answer)}%"></div><div class="mk you" style="left:${at(a)}%"></div></div>
        <div class="legend"><span><i style="background:var(--accent)"></i>you</span><span><i style="background:var(--navy)"></i>actual</span></div>`;
    }
    const srcs = [q.source, ...(q.extraSources || [])].filter(Boolean);
    return h(`<article class="card rv">
      <div class="rv-head"><span class="chip">${k + 1}. ${esc(q.category)}</span><span class="pts ${cls}">${Math.round(p * 100)}%</span></div>
      <p class="rv-q">${esc(q.prompt)}</p>
      ${body}
      ${s.note && q.type !== "bins" ? `<p class="small muted" style="margin:6px 0 0">${esc(s.note)}</p>` : ""}
      <p class="explain">${esc(q.explanation)}</p>
      <p class="cite">Source${srcs.length > 1 ? "s" : ""}: ${srcs.map((src, j) => `<a href="${esc(src.url)}" target="_blank" rel="noopener">${esc(srcs.length > 1 && srcs.every(x => x.publisher === src.publisher) ? src.title : src.publisher)}${src.published && srcs.length === 1 ? `, ${esc(src.published)}` : ""}</a> <sup class="ref">[${refs[j]}]</sup>`).join("; ")}</p>
      ${q.caveat ? `<p class="caveat">${esc(q.caveat)}</p>` : ""}
    </article>`);
  }

  // ---------- reset ----------
  function askReset() {
    const d = document.createElement("dialog");
    d.innerHTML = `<h3>Reset the quiz?</h3><p class="muted">This clears every answer saved in this browser.</p>
      <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="ghost" value="no">Cancel</button><button class="btn accent" value="yes">Reset</button></div>`;
    document.body.append(d);
    d.querySelectorAll("button").forEach(b => b.onclick = () => d.close(b.value));
    d.addEventListener("close", () => {
      if (d.returnValue === "yes") { wipe(); state = blank(); render(); window.scrollTo({ top: 0 }); }
      d.remove();
    });
    d.showModal();
  }
  document.getElementById("reset").onclick = askReset;

  render();
})();
