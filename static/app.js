// SALBAR dashboard script - plain JavaScript, no libraries.
// It only calls the four existing Flask endpoints and shows what they return.

const REFRESH_MS = 2000;      // how often to refresh (2 seconds)
const MAX_HISTORY = 10;       // how many rows to keep in the history table

const history = [];           // readings collected while this page is open
let lastKey = "";             // used to avoid adding duplicate rows

// ---------- small helpers ----------
const $ = (id) => document.getElementById(id);

function setText(id, value) {
  $(id).textContent = (value === null || value === undefined || value === "") ? "--" : value;
}

// Set a pill's colour class and text. kind = "ok" | "warn" | "bad" | ""
function setPill(id, kind, text) {
  const el = $(id);
  el.classList.remove("ok", "warn", "bad");
  if (kind) el.classList.add(kind);
  el.querySelector("span:last-child").textContent = text;
}

// Decide pill colour from a status string sent by the backend
function kindFromStatus(s) {
  const v = String(s || "").toLowerCase();
  if (["online", "ready", "connected", "active", "fix"].some(w => v.includes(w)) && !v.includes("not")) return "ok";
  if (v.includes("test")) return "warn";
  return "bad";   // "not connected", "offline", unknown, etc.
}

function pct(n) {
  return (typeof n === "number") ? (n * 100).toFixed(1) + "%" : "--";
}

async function getJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(url + " returned " + res.status);
  return res.json();
}

// ---------- clock ----------
function tickClock() {
  $("clock").textContent = new Date().toLocaleTimeString("en-GB");
}

// ---------- status (/api/status) ----------
function showStatus(s) {
  setPill("backendPill", "ok", "BACKEND ONLINE");
  $("backendPill").classList.add("ok");

  setPill("sysBackend", kindFromStatus(s.backend), s.backend);
  setPill("sysCnn",     kindFromStatus(s.cnn),     s.cnn);
  setPill("sysMlx",     kindFromStatus(s.mlx90640), s.mlx90640);
  setPill("sysGps",     kindFromStatus(s.gps),     s.gps);
  setPill("sysA7670e",  kindFromStatus(s.a7670e),  s.a7670e);

  setPill("cnnPill", kindFromStatus(s.cnn), s.cnn);
  setPill("mlxPill", kindFromStatus(s.mlx90640), s.mlx90640);

  const stamp = new Date().toLocaleTimeString("en-GB");
  setText("updatedText", "Last updated " + stamp);
}

// ---------- detection (/api/detection) ----------
function showDetection(d) {
  const isTest = String(d.detection_mode || "").toUpperCase() === "TEST"
              || String(d.sensor_status || "").toLowerCase().includes("test");

  // Always warn clearly when the data is test data
  $("testBanner").hidden = !isTest;

  const isHuman = String(d.classification).toLowerCase() === "human";
  const banner = $("detectBanner");
  banner.classList.remove("human", "nohuman", "offline");
  banner.classList.add(isHuman ? "human" : "nohuman");

  $("detectIcon").textContent = isHuman ? "!" : "✓";
  $("detectEyebrow").textContent = isTest ? "TEST RESULT (NOT LIVE)" : "ACTIVE DETECTION";

  if (isHuman) {
    $("detectTitle").textContent = isTest ? "CNN test result: human" : "Possible survivor detected";
    $("detectSub").textContent = isTest
      ? "This is a test input, not a real thermal reading. Do not use it for a real rescue decision."
      : "Human thermal signature detected. Review before alerting the response team.";
  } else {
    $("detectTitle").textContent = isTest ? "CNN test result: not human" : "No survivor detected";
    $("detectSub").textContent = isTest
      ? "This is a test input, not a real thermal reading."
      : "No human thermal signature detected.";
  }

  setText("bannerScore", pct(d.human_score));

  // CNN panel
  const cls = $("classResult");
  cls.textContent = d.classification || "--";
  cls.classList.toggle("human", isHuman);

  setText("humanScoreText", pct(d.human_score));
  setText("notHumanScoreText", pct(d.not_human_score));
  $("humanBar").style.width    = (typeof d.human_score === "number" ? d.human_score * 100 : 0) + "%";
  $("notHumanBar").style.width = (typeof d.not_human_score === "number" ? d.not_human_score * 100 : 0) + "%";

  setText("modeText", d.detection_mode);
  setText("sensorText", d.sensor);
  setText("sensorStatusText", d.sensor_status);

  if (isTest) {
    $("thermalMsg").textContent =
      "MLX90640 is not connected. The CNN is running on test data, so there is no live thermal image to show.";
  }

  addHistory(d);
}

// ---------- history (built in the browser, from /api/detection) ----------
function addHistory(d) {
  const key = d.classification + "|" + d.human_score + "|" + d.not_human_score + "|" + d.detection_mode;
  if (key === lastKey) return;          // same result as before, skip
  lastKey = key;

  history.unshift({
    time: new Date().toLocaleTimeString("en-GB"),
    result: d.classification,
    human: d.human_score,
    notHuman: d.not_human_score,
    mode: d.detection_mode
  });
  if (history.length > MAX_HISTORY) history.pop();

  const body = $("historyBody");
  body.innerHTML = "";
  history.forEach(h => {
    const tr = document.createElement("tr");
    const isHuman = String(h.result).toLowerCase() === "human";
    const cells = [
      h.time,
      h.result,
      pct(h.human),
      pct(h.notHuman),
      h.mode
    ];
    cells.forEach((text, i) => {
      const td = document.createElement("td");
      td.textContent = text;
      if (i === 1) td.className = isHuman ? "res-human" : "res-nohuman";
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
}

// ---------- location (/api/location) ----------
function showLocation(l) {
  const hasFix = l.latitude !== null && l.longitude !== null
              && l.latitude !== undefined && l.longitude !== undefined;

  setPill("gpsPill", kindFromStatus(l.gps_status), l.gps_status);

  if (hasFix) {
    setText("latText", Number(l.latitude).toFixed(6));
    setText("lonText", Number(l.longitude).toFixed(6));
    setText("accText", (l.accuracy !== null && l.accuracy !== undefined) ? "± " + l.accuracy + " m" : "--");
    $("gpsNotice").textContent = "GPS position received.";
    const link = $("mapLink");
    link.href = "https://www.openstreetmap.org/?mlat=" + l.latitude + "&mlon=" + l.longitude + "#map=18/" + l.latitude + "/" + l.longitude;
    link.hidden = false;
  } else {
    setText("latText", null);
    setText("lonText", null);
    setText("accText", null);
    $("gpsNotice").textContent = "GPS " + (l.gps_status || "not connected") + ". No location available yet.";
    $("mapLink").hidden = true;
  }
}

// ---------- alert (/api/alert) ----------
function showAlert(a) {
  setPill("cellPill", kindFromStatus(a.cellular_status), a.cellular_status);
  setText("cellText", a.cellular_status);
  setText("smsText", a.sms_status);

  const sent = String(a.sms_status || "").toLowerCase() === "sent";
  $("smsNotice").textContent = sent
    ? "An SMS alert was sent."
    : "No SMS has been sent.";
}

// ---------- backend offline ----------
function showOffline() {
  setPill("backendPill", "bad", "BACKEND OFFLINE");
  const banner = $("detectBanner");
  banner.classList.remove("human", "nohuman");
  banner.classList.add("offline");
  $("detectIcon").textContent = "?";
  $("detectEyebrow").textContent = "NO CONNECTION";
  $("detectTitle").textContent = "Cannot reach the SALBAR backend";
  $("detectSub").textContent = "Check that the Flask app is running on the Raspberry Pi. Retrying every 2 seconds.";
  setText("bannerScore", null);
  setText("updatedText", "Connection lost - retrying...");
}

// ---------- refresh loop ----------
async function refresh() {
  try {
    // Ask the four endpoints at the same time
    const [status, detection, location, alert] = await Promise.all([
      getJSON("/api/status"),
      getJSON("/api/detection"),
      getJSON("/api/location"),
      getJSON("/api/alert")
    ]);
    showStatus(status);
    showDetection(detection);
    showLocation(location);
    showAlert(alert);
  } catch (err) {
    console.error(err);
    showOffline();
  }
}

tickClock();
setInterval(tickClock, 1000);
refresh();
setInterval(refresh, REFRESH_MS);
