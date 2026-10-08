/* ------------------------------------------------------------------
   웹용 바탕화면.
   1) 창과 아이콘: 끌어서 옮기기, 열기·닫기, 아래 작업 줄
   2) YT2F.exe 받기 ("다른 이름으로 저장" 창)
   3) 메모장(설명·라이선스)과 정보 창
   4) 데모용 가짜 프로그램: 실제 프로그램에서 파이썬이 하는 일을 흉내만 낸다.
      링크를 넣으면 제목과 썸네일만 가져오고, 저장은 진행 화면만 보여 준다(파일은 만들지 않는다).
------------------------------------------------------------------- */
(function () {
  "use strict";
  var EXE_URL = "download/YT2F.exe", EXE_NAME = "YT2F.exe";
  var BAR = 46;                                   // 아래 작업 줄 높이
  var $ = function (id) { return document.getElementById(id); };
  var stage = $("deskStage");

  /* ================= 알림 ================= */
  var toastTimer = null;
  function toast(text, ms) {
    var t = $("deskToast");
    t.textContent = text; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, ms || 3200);
  }

  /* ================= 끌어서 옮기기 (마우스·터치 공통) ================= */
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  // box: 옮길 것, handle: 잡는 자리, pos: {x, y} 를 기억하는 곳
  function makeDraggable(box, handle, pos, opts) {
    opts = opts || {};
    handle.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      if (opts.skipControls && e.target.closest("button, a, input")) return;
      var r = box.getBoundingClientRect(), sx = e.clientX, sy = e.clientY, x0 = pos.x, y0 = pos.y;
      var moved = false, need = opts.threshold || 0;
      try { handle.setPointerCapture(e.pointerId); } catch (err) {}
      function move(ev) {
        var mx = ev.clientX - sx, my = ev.clientY - sy;
        if (!moved) {
          if (Math.abs(mx) < need && Math.abs(my) < need) return;
          moved = true; box.classList.add("dragging");
        }
        // 화면 밖으로 사라지지 않게: 위쪽 줄은 늘 잡을 수 있어야 한다
        mx = clamp(mx, 70 - r.right, window.innerWidth - 70 - r.left);
        my = clamp(my, -r.top, window.innerHeight - BAR - 34 - r.top);
        pos.x = x0 + mx; pos.y = y0 + my;
        box.style.setProperty("--dx", pos.x + "px"); box.style.setProperty("--dy", pos.y + "px");
      }
      function up() {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up); handle.removeEventListener("pointercancel", up);
        box.classList.remove("dragging");
        if (moved) { box._dragged = true; setTimeout(function () { box._dragged = false; }, 0); }
      }
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up); handle.addEventListener("pointercancel", up);
    });
  }

  /* ================= 창 ================= */
  var wins = {
    demo: { el: $("deskWin"), handle: $("grip"), pos: { x: 0, y: 0 }, task: null },
    note: { el: $("deskNote"), handle: $("deskNote").querySelector(".desk-title"), pos: { x: 0, y: 0 }, task: null },
    info: { el: $("deskInfo"), handle: $("deskInfo").querySelector(".desk-title"), pos: { x: 0, y: 0 }, task: null }
  };
  var zTop = 10, frontName = "demo", demoClosed = false;

  function isOpen(name) { return !wins[name].el.classList.contains("is-away"); }
  function place(name, x, y) {
    var w = wins[name]; w.pos.x = x; w.pos.y = y;
    w.el.style.setProperty("--dx", x + "px"); w.el.style.setProperty("--dy", y + "px");
  }
  function front(name) {
    wins[name].el.style.zIndex = String(++zTop);
    frontName = name; refreshTasks();
  }
  function show(name) {
    var w = wins[name];
    if (!isOpen(name)) {
      w.el.classList.remove("is-away"); w.el.removeAttribute("aria-hidden");
      w.el.classList.remove("opening"); void w.el.offsetWidth; w.el.classList.add("opening");
    }
    front(name);
  }
  function hide(name) {
    var w = wins[name];
    w.el.classList.add("is-away"); w.el.setAttribute("aria-hidden", "true");
    if (frontName === name) {
      frontName = "";
      ["demo", "note", "info"].forEach(function (n) {      // 남은 창 가운데 맨 위의 것
        if (isOpen(n) && (!frontName || Number(wins[n].el.style.zIndex || 0) > Number(wins[frontName].el.style.zIndex || 0))) frontName = n;
      });
    }
    refreshTasks();
  }
  function refreshTasks() {
    Object.keys(wins).forEach(function (n) {
      var b = wins[n].task; if (!b) return;
      b.hidden = n !== "demo" && !isOpen(n);                 // YT2F 는 늘 보이고, 나머지는 열려 있을 때만
      b.classList.toggle("on", n === "demo" ? !demoClosed : isOpen(n));
      b.classList.toggle("active", isOpen(n) && frontName === n);
    });
  }
  function fit() {      // 화면이 YT2F 창보다 작으면 통째로 줄인다
    var s = Math.min(1, (stage.clientWidth - 20) / 640, (stage.clientHeight - 20) / 700);
    wins.demo.el.style.setProperty("--s", String(Math.max(.3, s)));
  }

  Object.keys(wins).forEach(function (name) {
    var w = wins[name];
    w.task = document.querySelector('.desk-task[data-win="' + name + '"]');
    w.el.addEventListener("pointerdown", function () { if (frontName !== name) front(name); }, true);
    w.el.addEventListener("animationend", function (e) { if (e.target === w.el) w.el.classList.remove("opening"); });
    makeDraggable(w.el, w.handle, w.pos, { skipControls: true });
    w.task.addEventListener("click", function () {
      if (!isOpen(name)) { if (name === "demo") openDemo(); else show(name); }
      else if (frontName === name && name === "demo") hide(name);       // 맨 앞에 있을 때 누르면 최소화
      else front(name);
    });
    Array.prototype.forEach.call(w.el.querySelectorAll("[data-close]"), function (b) {
      b.addEventListener("click", function () { hide(name); });
    });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && (frontName === "note" || frontName === "info")) hide(frontName);
  });
  window.addEventListener("resize", fit);

  function openDemo() {
    if (demoClosed) {            // 닫았다 다시 열면 처음 상태로
      demoClosed = false;
      var url = $("url"), result = $("result");
      url.value = ""; url.dispatchEvent(new Event("input"));
      result.className = "result"; result.textContent = "";
    }
    show("demo");
  }

  /* ================= 메모장 ================= */
  var DOCS = {
    about: { title: "YT2F 설명.txt", file: "ABOUT.txt", inline: "deskAboutText" },
    license: { title: "LICENSE.txt", file: "LICENSE", inline: "deskLicenseText" }
  };
  var docNow = "";
  function setDoc(text) {
    var pre = $("deskNoteText");
    pre.textContent = text.replace(/\r\n/g, "\n").replace(/^\n+|\s+$/g, "");
    pre.scrollTop = 0;
  }
  function openDoc(kind) {
    var d = DOCS[kind];
    docNow = kind;
    $("deskNoteTitle").textContent = d.title + " - 메모장";
    setDoc($(d.inline).textContent);                      // 먼저 페이지에 들어 있는 사본을 보여 주고
    if (!isOpen("note") && window.innerWidth > 900) place("note", 150, 20);
    show("note");
    if (/^https?:$/.test(location.protocol)) {            // 웹에 올라가 있으면 저장소의 실제 파일로 바꾼다
      fetch(d.file, { cache: "no-cache" }).then(function (r) { return r.ok ? r.text() : Promise.reject(); })
        .then(function (text) { if (docNow === kind && text.trim()) setDoc(text); })
        .catch(function () {});
    }
  }

  /* ================= YT2F.exe 받기 ================= */
  function plainDownload() {
    var a = document.createElement("a");
    a.href = EXE_URL; a.download = EXE_NAME;
    document.body.appendChild(a); a.click(); a.remove();
    toast("YT2F.exe 를 받기 시작했습니다. 경고가 뜨는 이유는 '설명' 문서에 적어 두었습니다.", 5200);
  }
  var downloading = false;
  function downloadExe() {
    if (downloading) return;
    // "다른 이름으로 저장" 창을 직접 띄울 수 있는 브라우저(크롬·엣지)에서는 그렇게 하고, 아니면 보통 방식으로 받는다
    if (!(window.showSaveFilePicker && window.isSecureContext && /^https?:$/.test(location.protocol))) { plainDownload(); return; }
    downloading = true;
    var response = null;
    fetch(EXE_URL).then(function (r) {
      if (!r.ok || !r.body) throw new Error("fetch");
      response = r;
      return window.showSaveFilePicker({
        suggestedName: EXE_NAME,
        types: [{ description: "Windows 프로그램", accept: { "application/octet-stream": [".exe"] } }]
      });
    }).then(function (handle) {
      toast("YT2F.exe 를 받는 중입니다…", 60000);
      return handle.createWritable().then(function (out) { return response.body.pipeTo(out); });
    }).then(function () {
      downloading = false;
      toast("YT2F.exe 를 저장했습니다. 실행할 때 경고가 뜨는 이유는 '설명' 문서에 적어 두었습니다.", 5200);
    }).catch(function (err) {
      downloading = false;
      if (response && response.body && !response.body.locked) { try { response.body.cancel(); } catch (e) {} }
      if (err && err.name === "AbortError") { toast("받기를 취소했습니다."); return; }      // 저장 창에서 취소
      plainDownload();
    });
  }

  /* ================= 바탕화면 아이콘 ================= */
  var ACTIONS = {
    download: downloadExe,
    about: function () { openDoc("about"); },
    license: function () { openDoc("license"); },
    info: function () { if (!isOpen("info")) place("info", 0, 0); show("info"); }
  };
  Array.prototype.forEach.call(document.querySelectorAll(".desk-icon"), function (icon) {
    makeDraggable(icon, icon, { x: 0, y: 0 }, { threshold: 6 });
    icon.addEventListener("click", function (e) {
      if (icon._dragged) { e.preventDefault(); return; }    // 끌어서 옮긴 것은 누른 것으로 치지 않는다
      ACTIONS[icon.dataset.act]();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-open]"), function (b) {
    b.addEventListener("click", function () { ACTIONS[b.dataset.open](); });
  });

  /* ================= 시계 ================= */
  function tick() {
    var d = new Date(), h = d.getHours(), m = d.getMinutes();
    $("deskClock").textContent = (h < 12 ? "오전 " : "오후 ") + (h % 12 || 12) + ":" + (m < 10 ? "0" : "") + m;
  }
  tick(); setInterval(tick, 15000);

  /* ================= 데모용 가짜 프로그램 ================= */
  var FORMATS = [
    { id: "mp4", label: "MP4", kind: "video", ext: "mp4" },
    { id: "mp3", label: "MP3", kind: "audio", ext: "mp3", qualities: ["320", "256", "192", "128"], "default": "192" },
    { id: "ogg", label: "OGG", kind: "audio", ext: "ogg", qualities: ["256", "192", "128", "96"], "default": "192" },
    { id: "wav", label: "WAV", kind: "audio", ext: "wav", note: "lossless" },
    { id: "m4a", label: "M4A", kind: "audio", ext: "m4a", note: "copy" },
    { id: "flac", label: "FLAC", kind: "audio", ext: "flac", note: "lossless" }
  ];
  var BY_ID = {}; FORMATS.forEach(function (f) { BY_ID[f.id] = f; });
  var LADDER = [2160, 1440, 1080, 720, 480, 360, 240, 144];
  var SAMPLE = { id: "jNQXAC9IVRw", title: "Me at the zoo", channel: "jawed", duration: "0:19", res: 240, minutes: .32 };   // 유튜브 첫 영상 (원본 240p)
  var app = $("deskApp"), settings = {}, lastInfo = null, job = { active: false };

  try { settings = JSON.parse(localStorage.getItem("yt2f-demo") || "{}") || {}; } catch (e) { settings = {}; }
  function remember() { try { localStorage.setItem("yt2f-demo", JSON.stringify(settings)); } catch (e) {} }

  function transparency() {
    var v = Number(settings.transparency);
    return isFinite(v) && settings.transparency != null ? clamp(Math.round(v), 0, 60) : 35;
  }
  function applyGlass() { app.style.opacity = String(1 - transparency() / 100); }
  function glassInfo() { return { on: true, max: 60, transparency: transparency() }; }

  /* ---- 영상 정보 ---- */
  function videoId(text) {
    var m = /(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/.exec(text || "");
    return m ? m[1] : "";
  }
  function getJson(url) {
    var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, 2500);
    return fetch(url, { signal: ctl.signal }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error("http");
      return r.json();
    });
  }
  function lookup(id) {   // 제목과 채널 이름만 물어본다. 안 되면 없는 대로 보여 준다
    if (id === SAMPLE.id) return Promise.resolve(SAMPLE);
    var watch = encodeURIComponent("https://www.youtube.com/watch?v=" + id);
    function pick(d) { if (!d || !d.title) throw new Error("empty"); return { title: d.title, channel: d.author_name || "" }; }
    return getJson("https://www.youtube.com/oembed?format=json&url=" + watch).then(pick)
      .catch(function () { return getJson("https://noembed.com/embed?url=" + watch).then(pick); })
      .catch(function () { return { title: "유튜브 영상 " + id, channel: "" }; });
  }
  function makeInfo(id, found) {
    var rung = found.res || 1080;
    return {
      minutes: found.minutes || 0,
      title: found.title, channel: found.channel || "", duration: found.duration || "",
      thumbnail: "https://i.ytimg.com/vi/" + id + "/mqdefault.jpg",
      has_video: true, has_audio: true, max_res: rung, source_rung: rung, source_label: rung + "p",
      ladder: LADDER.map(function (r) { return { res: r, label: r + "p", enabled: r <= rung }; }),
      url: "https://www.youtube.com/watch?v=" + id
    };
  }
  function wait(ms) { return new Promise(function (done) { setTimeout(done, ms); }); }

  /* ---- 저장 흉내 ---- */
  function size(mb) { return mb < 1 ? Math.round(mb * 1024) + "KB" : mb.toFixed(1) + "MB"; }
  function startJob(req) {
    var f = BY_ID[req.fmt] || FORMATS[0];
    var res = Number(req.quality) || (lastInfo ? lastInfo.source_rung : 1080);
    var minutes = lastInfo && lastInfo.minutes ? lastInfo.minutes : 4;          // 길이를 모르면 4분짜리로 친다
    var videoMb = 11.5 * minutes * Math.pow(res / 1080, 1.5), audioMb = .95 * minutes;
    var name = String(req.title || "video").replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 60) + "." + f.ext;
    var steps = f.kind === "video"
      ? [{ stage: "영상 받는 중", from: 0, to: 90, ms: 3000, mb: videoMb }, { stage: "소리 받는 중", from: 90, to: 100, ms: 700, mb: audioMb },
         { stage: "영상과 소리를 합치는 중", ms: 900 }]
      : [{ stage: "받는 중", from: 0, to: 100, ms: 1700, mb: audioMb },
         { stage: f.note === "copy" ? "마무리하는 중" : f.label + " 로 변환하는 중", ms: 1000 }];
    var total = f.kind === "video" ? videoMb + audioMb : (f.note === "lossless" ? audioMb * 9 : audioMb);
    job = { active: true, steps: steps, t0: Date.now(), name: name, total: total };
    return name;
  }
  function jobState() {
    if (!job.active) return { active: false, cancelled: !!job.cancelled, done: !!job.done, stage: job.stage || "", pct: job.done ? 100 : null, detail: job.detail || "", path: job.path || "" };
    var t = Date.now() - job.t0;
    for (var i = 0; i < job.steps.length; i++) {
      var s = job.steps[i];
      if (t < s.ms) {
        if (s.mb == null) return { active: true, stage: s.stage, pct: null, detail: "" };
        var k = t / s.ms, speed = s.mb / (s.ms / 1000);
        return { active: true, stage: s.stage, pct: s.from + (s.to - s.from) * k,
                 detail: size(s.mb * k) + " / " + size(s.mb) + "   " + size(speed) + "/s" };
      }
      t -= s.ms;
    }
    job = { active: false, done: true, stage: "저장했습니다", detail: job.name + "   " + size(job.total), path: job.name };
    toast("웹 데모라서 실제 파일은 만들어지지 않습니다.");
    return jobState();
  }

  /* ---- 프로그램 화면이 부르는 함수들 (실제 프로그램과 같은 이름) ---- */
  function later(value, ms) { return wait(ms || 0).then(function () { return typeof value === "function" ? value() : value; }); }
  window.pywebview = { api: {
    init: function () {
      return later({ app: "YT2F", version: "2.0", formats: FORMATS, glass: glassInfo(),
                     settings: { fmt: BY_ID[settings.fmt] ? settings.fmt : "mp4", quality: settings.quality || {} },
                     engines: { ready: true, missing: [], can_install: true }, engine_labels: {}, engine_version: "웹 데모" });
    },
    paste: function () {       // 클립보드에 유튜브 링크가 있으면 그것을, 없으면 예시 링크를 넣는다
      var sample = "https://youtu.be/" + SAMPLE.id;
      if (!(navigator.clipboard && navigator.clipboard.readText)) return later(sample);
      return Promise.race([navigator.clipboard.readText(), wait(4000).then(function () { return ""; })])
        .then(function (text) { return videoId(text) ? String(text).trim() : sample; }, function () { return sample; });
    },
    analyze: function (url) {
      var id = videoId(url);
      if (!id) return later({ ok: false, error: "유튜브 영상 링크가 아닙니다. 웹 데모에서는 유튜브 링크만 불러옵니다." }, 500);
      return Promise.all([lookup(id), wait(650)]).then(function (r) {
        lastInfo = makeInfo(id, r[0]);
        return { ok: true, info: lastInfo };
      });
    },
    save: function (req) {     // 실제 프로그램은 여기서 "다른 이름으로 저장" 창을 띄운다
      settings.fmt = req.fmt; (settings.quality = settings.quality || {})[req.fmt] = req.quality; remember();
      var name = startJob(req);
      return later({ ok: true, started: true, path: name });
    },
    job_state: function () { return later(jobState); },
    cancel: function () { if (job.active) job = { active: false, cancelled: true, stage: "취소했습니다" }; return later(true); },
    setup_engines: function () { return later({ ok: true }); },
    update_engine: function () { return later({ ok: true, message: "웹 데모에서는 엔진을 쓰지 않습니다." }, 500); },
    show_in_folder: function () { toast("웹 데모라서 실제 파일은 만들어지지 않습니다."); return later(true); },
    set_transparency: function (v) { settings.transparency = v; remember(); applyGlass(); return later(glassInfo); },
    win_drag: function () { return later(true); },           // 끌기는 위의 makeDraggable 이 맡는다
    win_minimize: function () { hide("demo"); return later(true); },
    win_close: function () {
      if (job.active) job = { active: false, cancelled: true, stage: "취소했습니다" };
      demoClosed = true; hide("demo");
      return later(true);
    }
  } };

  fit(); applyGlass(); front("demo");
})();
