/**
 * KIKES HUEVO PWA CEL - App Celular Seccional Cauca (ALKA 1 + ALKA 2 + ALKA PALMAS)
 * - Al iniciar: carga Hoy + últimos 7 días (8 días) de las 3 carpetas de Drive.
 * - En refrescos / polling: consulta ÚNICAMENTE el archivo de hoy en cada carpeta.
 */

const PLANTS = [
  {
    id: 'ALKA1',
    name: 'ALKA 1',
    prodLabel: 'Producción 1 (PX1) y Producción 2 (PX2)',
    rangeLabel: '1–20',
    minGalpon: 1,
    maxGalpon: 20,
    color: '#2563eb',
    defaultFolderId: '1YH-koHjnW_SowWWF5bG_2YjTrjn_CHGo',
    sections: [
      { key: 'PX1', title: 'Producción 1 · PX1', rangeLabel: '1–10', minGalpon: 1, maxGalpon: 10 },
      { key: 'PX2', title: 'Producción 2 · PX2', rangeLabel: '11–20', minGalpon: 11, maxGalpon: 20 }
    ]
  },
  {
    id: 'ALKA2',
    name: 'ALKA 2',
    prodLabel: 'Producción 3 · PX3',
    rangeLabel: '21–30',
    minGalpon: 21,
    maxGalpon: 30,
    color: '#f59e0b',
    defaultFolderId: '1pRKUndHR9qpDtfHAY__IIDChzHxxVUZl',
    sections: [
      { key: 'PX3', title: 'Producción 3 · PX3', rangeLabel: '21–30', minGalpon: 21, maxGalpon: 30 }
    ]
  },
  {
    id: 'PALMAS',
    name: 'ALKA PALMAS',
    prodLabel: 'Producción Palmas · PXPALMAS',
    rangeLabel: '1–8',
    minGalpon: 1,
    maxGalpon: 8,
    color: '#2e9e22',
    defaultFolderId: '0AMF9kxJDWux9Uk9PVA',
    sections: [
      { key: 'PXPALMAS', title: 'Producción Palmas', rangeLabel: '1–8', minGalpon: 1, maxGalpon: 8 }
    ]
  }
];

const MQTT_TOPIC_DEFS = [
  { key: 'PX1', label: 'ALKA 1 · PX1 (1–10)', plantId: 'ALKA1', minGalpon: 1, maxGalpon: 10, defaultTopic: '@/KIKES/ALKA1/PX1/CONTEO' },
  { key: 'PX2', label: 'ALKA 1 · PX2 (11–20)', plantId: 'ALKA1', minGalpon: 11, maxGalpon: 20, defaultTopic: '@/KIKES/ALKA1/PX2/CONTEO' },
  { key: 'PX3', label: 'ALKA 2 · PX3 (21–30)', plantId: 'ALKA2', minGalpon: 21, maxGalpon: 30, defaultTopic: '@/KIKES/ALKA2/PX3/CONTEO' },
  { key: 'PXPALMAS', label: 'ALKA PALMAS (1–8)', plantId: 'PALMAS', minGalpon: 1, maxGalpon: 8, defaultTopic: '@/KIKES/ALKAPALMAS/PXPALMAS/CONTEO' }
];

const DEFAULT_MQTT_BROKER = 'wss://broker.emqx.io:8084/mqtt';

const CONFIG = {
  CLIENT_ID: '830764017290-lhj433d1luv0okqfefs1maba7omrjjjj.apps.googleusercontent.com',
  SCOPES: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
  STORAGE_KEYS: {
    AUTH_TOKEN: 'kikes_cauca_cel_token',
    AUTH_EXPIRY: 'kikes_cauca_cel_expiry',
    USER_INFO: 'kikes_cauca_cel_user',
    FOLDERS: 'kikes_cauca_cel_folders',
    POLL_SEC: 'kikes_cauca_cel_poll_sec',
    CACHE_DAYS: 'kikes_cauca_cel_cache_days',
    HOY_SOURCE: 'kikes_cauca_cel_hoy_source',
    MQTT_CFG: 'kikes_cauca_cel_mqtt_cfg',
    MQTT_TODAY: 'kikes_cauca_cel_mqtt_today'
  }
};

function loadSavedFolders() {
  const saved = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.FOLDERS) || '{}');
  return {
    ALKA1: saved.ALKA1 || PLANTS[0].defaultFolderId,
    ALKA2: saved.ALKA2 || PLANTS[1].defaultFolderId,
    PALMAS: saved.PALMAS || PLANTS[2].defaultFolderId
  };
}

function loadSavedMqttCfg() {
  try {
    const raw = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.MQTT_CFG) || '{}');
    const topics = raw.topics || {};
    return {
      enabled: raw.enabled !== false,
      brokerUrl: String(raw.brokerUrl || DEFAULT_MQTT_BROKER).trim() || DEFAULT_MQTT_BROKER,
      topics: {
        PX1: String(topics.PX1 || MQTT_TOPIC_DEFS[0].defaultTopic).trim(),
        PX2: String(topics.PX2 || MQTT_TOPIC_DEFS[1].defaultTopic).trim(),
        PX3: String(topics.PX3 || MQTT_TOPIC_DEFS[2].defaultTopic).trim(),
        PXPALMAS: String(topics.PXPALMAS || MQTT_TOPIC_DEFS[3].defaultTopic).trim()
      }
    };
  } catch {
    return {
      enabled: true,
      brokerUrl: DEFAULT_MQTT_BROKER,
      topics: {
        PX1: MQTT_TOPIC_DEFS[0].defaultTopic,
        PX2: MQTT_TOPIC_DEFS[1].defaultTopic,
        PX3: MQTT_TOPIC_DEFS[2].defaultTopic,
        PXPALMAS: MQTT_TOPIC_DEFS[3].defaultTopic
      }
    };
  }
}

function loadSavedHoySource() {
  const s = localStorage.getItem(CONFIG.STORAGE_KEYS.HOY_SOURCE);
  return s === 'mqtt' || s === 'drive' || s === 'auto' ? s : 'auto';
}

const State = {
  accessToken: localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN) || null,
  tokenExpiry: parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_EXPIRY) || '0', 10),
  userInfo: JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.USER_INFO) || 'null'),
  folders: loadSavedFolders(),
  pollSec: parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.POLL_SEC) || '60', 10),
  hoySource: loadSavedHoySource(),
  mqttCfg: loadSavedMqttCfg(),

  selectedPlant: 'TODAS',
  // Map<'PLANTA|YYYY-MM-DD', { planta, fecha, galpones, totalPlanta, modifiedTime, fileId }>
  storeMap: new Map(),
  // Map<'PX1'|'PX2'|'PX3'|'PXPALMAS', { fecha, valuesByNum, updatedAtByNum, total, raw, receivedAt, topic }>
  mqttDataByKey: new Map(),
  recentMqttChanges: new Map(),
  lastMqttTopicLabel: null,
  mqttState: 'offline', // offline | connecting | online
  startupLoadedForDate: null,
  initialDriveBaselineDone: false,
  isFetching: false,
  pollTimer: null,
  chart: null
};

const PLANT_LED_SESSION = new Map();

let gisTokenClient = null;
let mqttClient = null;

// =============================================================================
// INICIALIZACIÓN
// =============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initServiceWorker();
  initEventListeners();
  initChart();
  loadCacheIntoMemory();
  loadMqttCacheIntoMemory();
  syncHoySourceButtons();
  updateUserUI();
  absorbPendingPlantBaselines();
  renderAll();
  connectMqttClient();

  const hasHash = await checkUrlHashToken();
  if (!hasHash) {
    if (State.accessToken && Date.now() < State.tokenExpiry) {
      updateUserUI();
      hideLoginModal();
      await cargarInicio8Dias();
    } else {
      showLoginModal();
    }
  }

  restartPollTimer();
  setInterval(updateAllPlantFreshnessLeds, 15000);
});

function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW warning:', e));
  }
}

function getLocalDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getTarget8Dates(todayStr = getLocalDateStr()) {
  const base = new Date(todayStr + 'T12:00:00');
  const dates = [];
  for (let i = 0; i <= 7; i++) {
    const dt = new Date(base);
    dt.setDate(dt.getDate() - i);
    dates.push(getLocalDateStr(dt));
  }
  return dates;
}

function cleanFolderId(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  const idx = s.toLowerCase().indexOf('/folders/');
  if (idx >= 0) return s.slice(idx + 9).split(/[?/#&]/)[0].trim();
  return s.replace(/^[/\\]+|[/\\]+$/g, '');
}

function loadCacheIntoMemory() {
  try {
    const raw = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.CACHE_DAYS) || '{}');
    const validDates = new Set(getTarget8Dates());
    State.storeMap.clear();
    for (const [k, entry] of Object.entries(raw)) {
      if (entry && validDates.has(entry.fecha)) {
        State.storeMap.set(k, entry);
      }
    }
  } catch {
    State.storeMap.clear();
  }
}

function persistCache() {
  const validDates = new Set(getTarget8Dates());
  const obj = {};
  for (const [k, entry] of State.storeMap.entries()) {
    if (validDates.has(entry.fecha)) obj[k] = entry;
  }
  localStorage.setItem(CONFIG.STORAGE_KEYS.CACHE_DAYS, JSON.stringify(obj));
}

function loadMqttCacheIntoMemory() {
  try {
    const raw = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.MQTT_TODAY) || '{}');
    const todayStr = getLocalDateStr();
    State.mqttDataByKey.clear();
    for (const def of MQTT_TOPIC_DEFS) {
      const slot = raw[def.key];
      if (slot && slot.fecha === todayStr && slot.valuesObj) {
        const valuesByNum = {};
        let total = 0;
        for (let n = def.minGalpon; n <= def.maxGalpon; n++) {
          const val = Number(slot.valuesObj[n] || 0);
          valuesByNum[n] = val;
          total += val;
        }
        State.mqttDataByKey.set(def.key, {
          fecha: todayStr,
          valuesByNum,
          updatedAtByNum: slot.updatedAtByNum || {},
          total,
          raw: slot.raw || '',
          receivedAt: slot.receivedAt || null,
          isRetained: !!slot.isRetained,
          payloadFormat: slot.payloadFormat || 'raw',
          topic: slot.topic || State.mqttCfg.topics[def.key]
        });
      }
    }
  } catch {
    State.mqttDataByKey.clear();
  }
}

function persistMqttCache() {
  const todayStr = getLocalDateStr();
  const obj = {};
  for (const [key, slot] of State.mqttDataByKey.entries()) {
    if (slot.fecha === todayStr) {
      obj[key] = {
        fecha: slot.fecha,
        valuesObj: slot.valuesByNum,
        updatedAtByNum: slot.updatedAtByNum || {},
        raw: slot.raw,
        receivedAt: slot.receivedAt,
        isRetained: !!slot.isRetained,
        payloadFormat: slot.payloadFormat || 'raw',
        topic: slot.topic
      };
    }
  }
  localStorage.setItem(CONFIG.STORAGE_KEYS.MQTT_TODAY, JSON.stringify(obj));
}

// =============================================================================
// SUSCRIPCIÓN MQTT EN TIEMPO REAL (SOLO PARA EL DÍA ACTUAL)
// =============================================================================
function setMqttVisual(state, label) {
  State.mqttState = state;
  const dot = document.getElementById('mqttDot');
  const lbl = document.getElementById('lblMqttEstado');
  if (dot) {
    dot.classList.remove('online', 'connecting', 'offline');
    dot.classList.add(state);
  }
  if (lbl && label) lbl.textContent = label;
}

function flashMqttDot() {
  const dot = document.getElementById('mqttDot');
  if (!dot) return;
  dot.classList.add('flash');
  setTimeout(() => dot.classList.remove('flash'), 650);
}

function disconnectMqttClient() {
  if (mqttClient) {
    try {
      mqttClient.removeAllListeners();
      mqttClient.end(true);
    } catch { }
    mqttClient = null;
  }
}

function connectMqttClient() {
  disconnectMqttClient();

  if (!State.mqttCfg.enabled) {
    setMqttVisual('offline', 'MQTT desactivado');
    renderMqttDebugList();
    return;
  }

  if (typeof mqtt === 'undefined' || typeof mqtt.connect !== 'function') {
    setMqttVisual('offline', 'MQTT lib no cargada');
    return;
  }

  setMqttVisual('connecting', 'MQTT: Conectando...');

  const clientId = 'KIKES_CAUCA_CEL_' + Math.random().toString(16).slice(2, 8);
  mqttClient = mqtt.connect(State.mqttCfg.brokerUrl, {
    clientId,
    clean: true,
    reconnectPeriod: 4000,
    connectTimeout: 10000
  });

  mqttClient.on('connect', () => {
    const activeTopics = MQTT_TOPIC_DEFS
      .map((d) => State.mqttCfg.topics[d.key])
      .filter(Boolean);

    if (activeTopics.length > 0) {
      mqttClient.subscribe(activeTopics, { qos: 0 }, (err) => {
        if (err) {
          setMqttVisual('offline', 'MQTT error suscripción');
          console.warn('MQTT subscribe error:', err);
        } else {
          updateMqttStatusLabel();
        }
      });
    } else {
      updateMqttStatusLabel();
    }
  });

  mqttClient.on('reconnect', () => {
    setMqttVisual('connecting', 'MQTT: Reconectando...');
  });

  mqttClient.on('offline', () => {
    setMqttVisual('offline', 'MQTT: Sin conexión');
  });

  mqttClient.on('error', (err) => {
    console.warn('MQTT error:', err?.message || err);
    setMqttVisual('offline', 'MQTT: Error conexión');
  });

  mqttClient.on('message', (topic, payloadBuffer, packet) => {
    handleIncomingMqttMessage(topic, payloadBuffer ? payloadBuffer.toString() : '', !!packet?.retain);
  });
}

function parseMqttPayload(payloadStr) {
  const s = String(payloadStr || '').trim();
  if (!s) return { raw: '', timestampIso: null, format: 'empty' };
  if (s.startsWith('{')) {
    try {
      const obj = JSON.parse(s);
      if (obj && obj.value !== undefined && obj.value !== null) {
        const rawVal = String(obj.value).trim();
        const rawTs = obj.timestamp ?? obj.ts ?? obj.fechaHora ?? null;
        let timestampIso = null;
        if (rawTs) {
          const parsedMs = Date.parse(String(rawTs));
          if (Number.isFinite(parsedMs) && parsedMs > 0) {
            timestampIso = new Date(parsedMs).toISOString();
          }
        }
        return { raw: rawVal, timestampIso, format: 'json' };
      }
    } catch { }
  }
  return { raw: s, timestampIso: null, format: 'raw' };
}

function handleIncomingMqttMessage(topic, payloadStr, isRetained = false) {
  const matchingDefs = MQTT_TOPIC_DEFS.filter((d) => State.mqttCfg.topics[d.key] === topic);
  if (matchingDefs.length === 0) return;

  const parsedPayload = parseMqttPayload(payloadStr);
  const raw = parsedPayload.raw;
  if (!raw) return;

  const parts = raw.split(/[|,;]/).map((p) => p.trim());
  if (parts.length === 0) return;

  const todayStr = getLocalDateStr();
  if (parsedPayload.timestampIso) {
    const msgDateStr = getLocalDateStr(new Date(parsedPayload.timestampIso));
    if (msgDateStr !== todayStr) {
      // Mensaje retenido de un día anterior: no cargarlo como producción de hoy
      return;
    }
  }
  const nowIso = new Date().toISOString();
  const effectiveTs = parsedPayload.timestampIso || nowIso;
  let anyChanged = false;
  const changedPlantIds = new Set();

  for (const def of matchingDefs) {
    const prevSlot = State.mqttDataByKey.get(def.key);
    const sameDayPrev = prevSlot && prevSlot.fecha === todayStr ? prevSlot : null;
    const expectedCount = def.maxGalpon - def.minGalpon + 1;
    const valuesByNum = {};
    let total = 0;

    for (let i = 0; i < expectedCount; i++) {
      const galponNum = def.minGalpon + i;
      const cell = parts[i] !== undefined ? parts[i].replace(/[^\d-]/g, '') : '0';
      const val = parseInt(cell, 10) || 0;
      valuesByNum[galponNum] = val;
      total += val;
    }

    const sameAllValues = !!sameDayPrev && (
      sameDayPrev.raw === raw ||
      Array.from({ length: expectedCount }, (_, idx) => def.minGalpon + idx)
        .every((n) => Number(sameDayPrev.valuesByNum?.[n] ?? NaN) === Number(valuesByNum[n]))
    );

    if (sameAllValues) {
      // El valor completo no cambió: conservar intactas todas las horas (tópico, galpones y LEDs)
      continue;
    }

    const updatedAtByNum = {};
    for (let i = 0; i < expectedCount; i++) {
      const galponNum = def.minGalpon + i;
      const val = valuesByNum[galponNum];
      const prevVal = sameDayPrev?.valuesByNum?.[galponNum];
      if (!sameDayPrev || prevVal !== val) {
        updatedAtByNum[galponNum] = effectiveTs;
        if (sameDayPrev) {
          State.recentMqttChanges.set(`${def.plantId}|${galponNum}`, Date.now());
        }
      } else {
        updatedAtByNum[galponNum] = sameDayPrev.updatedAtByNum?.[galponNum] || sameDayPrev.receivedAt || effectiveTs;
      }
    }

    State.mqttDataByKey.set(def.key, {
      fecha: todayStr,
      valuesByNum,
      updatedAtByNum,
      total,
      raw,
      receivedAt: effectiveTs,
      isRetained,
      payloadFormat: parsedPayload.format,
      topic
    });
    State.lastMqttTopicLabel = def.label;
    anyChanged = true;
    changedPlantIds.add(def.plantId);
  }

  if (anyChanged) {
    const affectedIds = Array.from(changedPlantIds);
    if (isRetained) {
      absorbPendingPlantBaselines(affectedIds);
    } else {
      confirmLivePlantUpdates(affectedIds);
    }
    persistMqttCache();
    flashMqttDot();
    updateMqttStatusLabel();
    renderAll();
    setTimeout(() => {
      const cutoff = Date.now() - 5500;
      let cleaned = false;
      for (const [k, ts] of State.recentMqttChanges.entries()) {
        if (ts <= cutoff) {
          State.recentMqttChanges.delete(k);
          cleaned = true;
        }
      }
      if (cleaned) renderAll();
    }, 5800);
  }
}

function updateMqttStatusLabel() {
  const todayStr = getLocalDateStr();
  let receivedCount = 0;
  let latestIso = null;
  let latestLabel = '';

  for (const def of MQTT_TOPIC_DEFS) {
    const slot = State.mqttDataByKey.get(def.key);
    if (slot && slot.fecha === todayStr) {
      receivedCount++;
      if (slot.receivedAt && (!latestIso || slot.receivedAt > latestIso)) {
        latestIso = slot.receivedAt;
        latestLabel = def.label;
      }
    }
  }

  if (mqttClient && mqttClient.connected) {
    const labelName = latestLabel ? latestLabel.split('(')[0].trim() : (State.lastMqttTopicLabel ? State.lastMqttTopicLabel.split('(')[0].trim() : '');
    const timePart = latestIso
      ? ` · ${labelName ? labelName + ' ' : ''}${new Date(latestIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : '';
    setMqttVisual('online', `MQTT: ${receivedCount}/${MQTT_TOPIC_DEFS.length}${timePart}`);
  } else if (State.mqttCfg.enabled) {
    setMqttVisual('connecting', `MQTT (${receivedCount}/${MQTT_TOPIC_DEFS.length})`);
  } else {
    setMqttVisual('offline', 'MQTT desactivado');
  }

  renderMqttDebugList();
}

function renderMqttDebugList() {
  const el = document.getElementById('mqttDebugList');
  if (!el) return;
  const todayStr = getLocalDateStr();

  el.innerHTML = MQTT_TOPIC_DEFS.map((def) => {
    const topic = State.mqttCfg.topics[def.key] || def.defaultTopic;
    const slot = State.mqttDataByKey.get(def.key);
    const activeToday = slot && slot.fecha === todayStr;
    const hora = activeToday && slot.receivedAt
      ? new Date(slot.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : 'Sin datos hoy';
    const rawPreview = activeToday ? `${slot.raw} (= ${slot.total.toLocaleString()})` : '--';

    return `
      <div class="mqtt-dbg-row">
        <div class="mqtt-dbg-top">
          <span>${escapeHtml(def.label)}</span>
          <span>${escapeHtml(hora)}</span>
        </div>
        <div class="mqtt-dbg-val">${escapeHtml(topic)}</div>
        <div class="mqtt-dbg-val"><strong>${escapeHtml(rawPreview)}</strong></div>
      </div>
    `;
  }).join('');
}

function syncHoySourceButtons() {
  document.querySelectorAll('#hoySourceSeg .sseg-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.source === State.hoySource);
  });
}

// =============================================================================
// GOOGLE OAUTH2 (GIS)
// =============================================================================
function initGisAuthClient() {
  if (typeof google !== 'undefined' && google.accounts?.oauth2) {
    gisTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope: CONFIG.SCOPES,
      callback: async (res) => {
        if (res.error) {
          showToast('Error Google Auth: ' + res.error, 'error');
          return;
        }
        if (res.access_token) {
          State.accessToken = res.access_token;
          State.tokenExpiry = Date.now() + (parseInt(res.expires_in || '3600', 10) * 1000) - 60000;
          localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN, State.accessToken);
          localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_EXPIRY, State.tokenExpiry.toString());
          await onAuthenticated();
        }
      }
    });
  }
}

function loginWithGoogle() {
  if (!gisTokenClient) initGisAuthClient();
  if (gisTokenClient) {
    gisTokenClient.requestAccessToken({ prompt: 'select_account' });
  } else {
    const redirectUri = window.location.origin + window.location.pathname;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(CONFIG.CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token` +
      `&scope=${encodeURIComponent(CONFIG.SCOPES)}` +
      `&prompt=select_account`;
    window.location.href = authUrl;
  }
}

async function checkUrlHashToken() {
  const hash = window.location.hash.substring(1);
  if (!hash) return false;
  const params = new URLSearchParams(hash);
  const token = params.get('access_token');
  const expiresIn = parseInt(params.get('expires_in') || '3600', 10);
  if (!token) return false;

  State.accessToken = token;
  State.tokenExpiry = Date.now() + (expiresIn * 1000) - 60000;
  localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN, State.accessToken);
  localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_EXPIRY, State.tokenExpiry.toString());
  window.history.replaceState(null, '', window.location.pathname);

  await onAuthenticated();
  return true;
}

async function onAuthenticated() {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${State.accessToken}` }
    });
    if (res.ok) {
      State.userInfo = await res.json();
      localStorage.setItem(CONFIG.STORAGE_KEYS.USER_INFO, JSON.stringify(State.userInfo));
    }
  } catch { }
  updateUserUI();
  hideLoginModal();
  showToast('Conectado a Google Drive', 'success');
  await cargarInicio8Dias();
}

function logoutGoogle() {
  State.accessToken = null;
  State.tokenExpiry = 0;
  State.userInfo = null;
  State.startupLoadedForDate = null;
  localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
  localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_EXPIRY);
  localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_INFO);
  updateUserUI();
  showLoginModal();
}

function showLoginModal() { document.getElementById('loginOverlay')?.classList.remove('hidden'); }
function hideLoginModal() { document.getElementById('loginOverlay')?.classList.add('hidden'); }

function updateUserUI() {
  const hasGoogle = !!(State.accessToken && Date.now() < State.tokenExpiry);
  document.getElementById('lblUserEmail').textContent = hasGoogle
    ? (State.userInfo?.email || 'Sesión Google activa')
    : 'Sin sesión';
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.textContent = hasGoogle ? 'Salir' : 'Entrar Google';
    btnLogout.classList.toggle('btn-m-danger', hasGoogle);
    btnLogout.classList.toggle('btn-m-green', !hasGoogle);
  }

  document.getElementById('inputFolderAlka1').value = State.folders.ALKA1;
  document.getElementById('inputFolderAlka2').value = State.folders.ALKA2;
  document.getElementById('inputFolderPalmas').value = State.folders.PALMAS;
  document.getElementById('selectPollSec').value = String(State.pollSec);

  const chkMqtt = document.getElementById('chkMqttEnabled');
  if (chkMqtt) chkMqtt.checked = !!State.mqttCfg.enabled;
  const inBroker = document.getElementById('inputMqttBroker');
  if (inBroker) inBroker.value = State.mqttCfg.brokerUrl;
  const inPx1 = document.getElementById('inputMqttTopicPx1');
  if (inPx1) inPx1.value = State.mqttCfg.topics.PX1;
  const inPx2 = document.getElementById('inputMqttTopicPx2');
  if (inPx2) inPx2.value = State.mqttCfg.topics.PX2;
  const inPx3 = document.getElementById('inputMqttTopicPx3');
  if (inPx3) inPx3.value = State.mqttCfg.topics.PX3;
  const inPalmas = document.getElementById('inputMqttTopicPalmas');
  if (inPalmas) inPalmas.value = State.mqttCfg.topics.PXPALMAS;

  renderMqttDebugList();
}

// =============================================================================
// DRIVE SYNC (INICIO: 8 DÍAS x 3 PLANTAS | DESPUÉS: SOLO HOY)
// =============================================================================
async function cargarInicio8Dias(forceRefreshAll = false) {
  if (!ensureValidSession() || State.isFetching) return;

  State.isFetching = true;
  setSyncVisual('syncing', 'Cargando Cauca 7d...');

  try {
    const todayStr = getLocalDateStr();
    const targetDates = getTarget8Dates(todayStr);
    const targetSet = new Set(targetDates);

    let downloaded = 0;

    await Promise.all(PLANTS.map(async (plant) => {
      const folderId = cleanFolderId(State.folders[plant.id]) || plant.defaultFolderId;
      if (!folderId) return;

      try {
        const q = `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&orderBy=name desc&pageSize=30&supportsAllDrives=true&includeItemsFromAllDrives=true`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${State.accessToken}` } });
        if (res.status === 401) throw new Error('AUTH_EXPIRED');
        if (!res.ok) return;

        const data = await res.json();
        for (const file of (data.files || [])) {
          const m = String(file.name).match(/(\d{4})(\d{2})(\d{2})\.csv$/i);
          if (!m) continue;
          const fecha = `${m[1]}-${m[2]}-${m[3]}`;
          if (!targetSet.has(fecha)) continue;

          const key = `${plant.id}|${fecha}`;
          const cached = State.storeMap.get(key);
          const isPast = fecha < todayStr;
          if (!forceRefreshAll && cached) {
            if (isPast && cached.fileId === file.id) continue;
            if (!isPast && cached.modifiedTime === (file.modifiedTime || '')) continue;
          }

          const parsed = await downloadAndParseCsv(file.id);
          if (parsed) {
            State.storeMap.set(key, {
              planta: plant.id,
              fecha,
              galpones: parsed.galpones,
              totalPlanta: parsed.totalPlanta,
              modifiedTime: file.modifiedTime || '',
              fileId: file.id
            });
            downloaded++;
          }
        }
      } catch (e) {
        if (e.message === 'AUTH_EXPIRED') throw e;
        console.warn(`Error cargando ${plant.name}:`, e);
      }
    }));

    for (const [k, v] of Array.from(State.storeMap.entries())) {
      if (!targetSet.has(v.fecha)) State.storeMap.delete(k);
    }

    State.startupLoadedForDate = todayStr;
    const wasInitialDrive = !State.initialDriveBaselineDone;
    State.initialDriveBaselineDone = true;
    persistCache();
    if (wasInitialDrive) {
      absorbPendingPlantBaselines();
    } else if (downloaded > 0) {
      confirmLivePlantUpdates();
    }
    renderAll();
    setSyncVisual('ready', `Hoy (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`);

    if (downloaded > 0) {
      showToast(`Cauca cargado: ${downloaded} archivo(s) recientes.`, 'success');
    }
  } catch (err) {
    handleDriveError(err);
  } finally {
    State.isFetching = false;
  }
}

async function refrescarSoloHoy(manual = false) {
  if (!ensureValidSession() || State.isFetching) return;

  const todayStr = getLocalDateStr();
  if (State.startupLoadedForDate !== todayStr) {
    await cargarInicio8Dias();
    return;
  }

  State.isFetching = true;
  setSyncVisual('syncing', 'Consultando hoy...');

  try {
    const ymd = todayStr.replace(/-/g, '');
    let updatedCount = 0;

    await Promise.all(PLANTS.map(async (plant) => {
      const folderId = cleanFolderId(State.folders[plant.id]) || plant.defaultFolderId;
      if (!folderId) return;

      try {
        const q = `'${folderId}' in parents and name contains '${ymd}.csv' and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&pageSize=3&supportsAllDrives=true&includeItemsFromAllDrives=true`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${State.accessToken}` } });
        if (res.status === 401) throw new Error('AUTH_EXPIRED');
        if (!res.ok) return;

        const data = await res.json();
        const file = (data.files || [])[0];
        if (!file) return;

        const key = `${plant.id}|${todayStr}`;
        const existing = State.storeMap.get(key);
        if (existing && existing.modifiedTime === (file.modifiedTime || '')) return;

        const parsed = await downloadAndParseCsv(file.id);
        if (parsed) {
          State.storeMap.set(key, {
            planta: plant.id,
            fecha: todayStr,
            galpones: parsed.galpones,
            totalPlanta: parsed.totalPlanta,
            modifiedTime: file.modifiedTime || '',
            fileId: file.id
          });
          updatedCount++;
        }
      } catch (e) {
        if (e.message === 'AUTH_EXPIRED') throw e;
        console.warn(`Error hoy ${plant.name}:`, e);
      }
    }));

    if (updatedCount > 0) {
      persistCache();
      confirmLivePlantUpdates();
      renderAll();
      if (manual) showToast(`Hoy actualizado (${updatedCount} planta(s)).`, 'success');
    } else if (manual) {
      showToast('Hoy ya está actualizado.', 'info');
    }

    setSyncVisual('ready', `Hoy (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`);
  } catch (err) {
    handleDriveError(err);
  } finally {
    State.isFetching = false;
  }
}

async function downloadAndParseCsv(fileId) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${State.accessToken}` }
  });
  if (!res.ok) return null;
  return parseProductionCsv(await res.text());
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseProductionCsv(csvText) {
  const clean = csvText.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return { galpones: [], totalPlanta: 0 };

  const galpones = [];
  let totalPlanta = null;

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 5) continue;
    const gCol = String(cols[1]).trim().toUpperCase();
    const codigo = String(cols[2]).trim();
    const nombre = String(cols[3]).trim();
    const val = parseInt(String(cols[4]).replace(/[^\d-]/g, ''), 10) || 0;

    if (gCol === 'TOTAL' || codigo === 'TOTAL') {
      totalPlanta = val;
    } else {
      const num = parseInt(gCol, 10);
      if (!isNaN(num)) {
        galpones.push({
          numeroGalpon: num,
          codigoGalpon: codigo || `GALPON${num}`,
          nombreGalpon: nombre || `Galpón ${num}`,
          totalProduccion: val
        });
      }
    }
  }

  galpones.sort((a, b) => a.numeroGalpon - b.numeroGalpon);
  if (totalPlanta === null) totalPlanta = galpones.reduce((s, g) => s + g.totalProduccion, 0);
  return { galpones, totalPlanta };
}

function ensureValidSession() {
  if (!State.accessToken || Date.now() >= State.tokenExpiry) {
    showLoginModal();
    return false;
  }
  return true;
}

function handleDriveError(err) {
  if (err.message === 'AUTH_EXPIRED') {
    logoutGoogle();
    showToast('Sesión expirada. Entra nuevamente.', 'error');
  } else {
    setSyncVisual('error', 'Error Drive');
    showToast('Error Drive: ' + err.message, 'error');
  }
}

function setSyncVisual(state, label) {
  const dot = document.getElementById('syncDot');
  const ico = document.getElementById('refreshIcon');
  const sub = document.getElementById('lblHeaderStatus');
  dot.classList.remove('syncing', 'error');
  ico.classList.remove('spin');
  if (state === 'syncing') { dot.classList.add('syncing'); ico.classList.add('spin'); }
  else if (state === 'error') dot.classList.add('error');
  if (sub && label) sub.textContent = label;
}

// =============================================================================
// RESOLUCIÓN DE FUENTE POR CADA DATO GALPÓN (SOLO HOY: AUTO / MQTT / ARCHIVOS)
// =============================================================================
function selectGalponReadingToday(driveItem, driveTime, mqttSlot, galponNum, mode) {
  const driveVal = driveItem ? Number(driveItem.totalProduccion || 0) : null;
  const hasMqtt = !!mqttSlot;
  const mqttVal = hasMqtt ? Number(mqttSlot.valuesByNum[galponNum] || 0) : null;
  const mqttTime = hasMqtt ? (mqttSlot.updatedAtByNum?.[galponNum] || mqttSlot.receivedAt) : null;

  if (mode === 'mqtt') {
    return {
      val: mqttVal ?? 0,
      source: hasMqtt ? 'MQTT' : 'NONE',
      updatedAt: mqttTime,
      diffVsDrive: 0
    };
  }

  if (mode === 'drive') {
    return {
      val: driveVal ?? 0,
      source: driveItem ? 'DRIVE' : 'NONE',
      updatedAt: driveTime,
      diffVsDrive: 0
    };
  }

  // Modo AUTO (automático por cada dato galpón):
  if (!hasMqtt && !driveItem) {
    return { val: 0, source: 'NONE', updatedAt: null, diffVsDrive: 0 };
  }
  if (hasMqtt && !driveItem) {
    return { val: mqttVal, source: 'MQTT', updatedAt: mqttTime, diffVsDrive: 0 };
  }
  if (!hasMqtt && driveItem) {
    return { val: driveVal, source: 'DRIVE', updatedAt: driveTime, diffVsDrive: 0 };
  }

  // Ambos existen para este galpón hoy:
  // Si MQTT trae 0 mientras Archivo ya tenía dato > 0 hoy, proteger dato de Archivo;
  // en otro caso preferir MQTT si es mensaje en vivo más reciente o un conteo >= Archivo.
  if (mqttVal === 0 && driveVal > 0) {
    return { val: driveVal, source: 'DRIVE', updatedAt: driveTime, diffVsDrive: 0 };
  }

  const isLiveNewer = !mqttSlot.isRetained && mqttTime && driveTime && mqttTime >= driveTime;
  if (isLiveNewer || mqttVal >= driveVal) {
    return {
      val: mqttVal,
      source: 'MQTT',
      updatedAt: mqttTime,
      diffVsDrive: driveVal > 0 ? (mqttVal - driveVal) : 0
    };
  }

  return { val: driveVal, source: 'DRIVE', updatedAt: driveTime, diffVsDrive: 0 };
}

function getEffectivePlantEntry(plantId, fecha) {
  const todayStr = getLocalDateStr();
  const driveEntry = State.storeMap.get(`${plantId}|${fecha}`);

  // Días anteriores a hoy siempre salen exclusivamente de archivos Drive
  if (fecha !== todayStr || State.hoySource === 'drive') {
    if (!driveEntry) {
      return { planta: plantId, fecha, galpones: [], totalPlanta: 0, modifiedTime: null, source: 'NONE' };
    }
    const galpones = (driveEntry.galpones || []).map((g) => ({
      ...g,
      source: 'DRIVE',
      updatedAt: driveEntry.modifiedTime || null,
      diffVsDrive: 0
    }));
    return { ...driveEntry, galpones, source: 'DRIVE' };
  }

  const driveByNum = new Map((driveEntry?.galpones || []).map((g) => [g.numeroGalpon, g]));
  const topicDefs = MQTT_TOPIC_DEFS.filter((d) => d.plantId === plantId);
  const galpones = [];
  let totalPlanta = 0;
  let mqttGalponCount = 0;
  let driveGalponCount = 0;
  let latestMod = null;
  let latestMqttMod = null;

  for (const def of topicDefs) {
    const slot = State.mqttDataByKey.get(def.key);
    const mqttSlot = slot && slot.fecha === todayStr ? slot : null;

    for (let n = def.minGalpon; n <= def.maxGalpon; n++) {
      const dMeta = driveByNum.get(n);
      const picked = selectGalponReadingToday(dMeta, driveEntry?.modifiedTime || null, mqttSlot, n, State.hoySource);

      if (picked.source === 'MQTT') {
        mqttGalponCount++;
        if (picked.updatedAt && (!latestMqttMod || picked.updatedAt > latestMqttMod)) {
          latestMqttMod = picked.updatedAt;
        }
      } else if (picked.source === 'DRIVE') {
        driveGalponCount++;
      }

      if (picked.updatedAt && (!latestMod || picked.updatedAt > latestMod)) {
        latestMod = picked.updatedAt;
      }

      totalPlanta += picked.val;
      galpones.push({
        numeroGalpon: n,
        codigoGalpon: dMeta?.codigoGalpon || `GALPON${n}`,
        nombreGalpon: dMeta?.nombreGalpon || `Galpón ${n}`,
        totalProduccion: picked.val,
        source: picked.source,
        updatedAt: picked.updatedAt,
        diffVsDrive: picked.diffVsDrive
      });
    }
  }

  let source = 'NONE';
  if (mqttGalponCount > 0 && driveGalponCount > 0) source = 'MIX';
  else if (mqttGalponCount > 0) source = 'MQTT';
  else if (driveGalponCount > 0) source = 'DRIVE';

  // Si toda la planta proviene exclusivamente de Drive, conservar el total declarado del CSV
  if (source === 'DRIVE' && driveEntry) {
    return {
      ...driveEntry,
      galpones,
      source: 'DRIVE',
      latestMqttMod: null
    };
  }

  galpones.sort((a, b) => a.numeroGalpon - b.numeroGalpon);
  return { planta: plantId, fecha, galpones, totalPlanta, modifiedTime: latestMod, latestMqttMod, source };
}

function getSourceBadgeMeta(source) {
  if (source === 'MQTT') return { cls: 'src-mqtt', text: 'MQTT' };
  if (source === 'DRIVE') return { cls: 'src-drive', text: 'Archivo' };
  if (source === 'MIX') return { cls: 'src-mix', text: 'MQTT+Arch' };
  return { cls: 'src-none', text: 'Sin dato' };
}

function getPlantLedSignature(entry) {
  const galpones = entry?.galpones || [];
  if (galpones.length === 0) return `0|${Number(entry?.totalPlanta || 0)}`;
  return galpones.map((g) => `${g.numeroGalpon}:${Number(g.totalProduccion || 0)}`).join('|');
}

function ensurePlantLedSession(plantId, todayStr, entry, nowMs = Date.now()) {
  let rec = PLANT_LED_SESSION.get(plantId);
  const sig = getPlantLedSignature(entry);
  if (!rec || rec.fecha !== todayStr) {
    rec = {
      fecha: todayStr,
      initialSig: sig,
      lastSeenSig: sig,
      waitStartedMs: nowMs,
      confirmedChange: false,
      lastConfirmedAtMs: null
    };
    PLANT_LED_SESSION.set(plantId, rec);
  }
  return rec;
}

function absorbPendingPlantBaselines(plantIds = null) {
  const todayStr = getLocalDateStr();
  const nowMs = Date.now();
  const targets = plantIds || PLANTS.map((p) => p.id);
  for (const plantId of targets) {
    const entry = getEffectivePlantEntry(plantId, todayStr);
    const sig = getPlantLedSignature(entry);
    const rec = ensurePlantLedSession(plantId, todayStr, entry, nowMs);
    if (!rec.confirmedChange) {
      rec.initialSig = sig;
      rec.lastSeenSig = sig;
    }
  }
}

function confirmLivePlantUpdates(plantIds = null) {
  const todayStr = getLocalDateStr();
  const nowMs = Date.now();
  const targets = plantIds || PLANTS.map((p) => p.id);
  for (const plantId of targets) {
    const entry = getEffectivePlantEntry(plantId, todayStr);
    const sig = getPlantLedSignature(entry);
    const rec = ensurePlantLedSession(plantId, todayStr, entry, nowMs);
    if (!rec.confirmedChange) {
      if (sig !== rec.initialSig) {
        rec.confirmedChange = true;
        rec.lastSeenSig = sig;
        const tsMs = entry?.modifiedTime ? new Date(entry.modifiedTime).getTime() : NaN;
        rec.lastConfirmedAtMs = (Number.isFinite(tsMs) && tsMs > 0 && tsMs <= nowMs + 60000)
          ? Math.min(nowMs, tsMs)
          : nowMs;
      }
    } else if (sig !== rec.lastSeenSig) {
      rec.lastSeenSig = sig;
      const tsMs = entry?.modifiedTime ? new Date(entry.modifiedTime).getTime() : NaN;
      rec.lastConfirmedAtMs = (Number.isFinite(tsMs) && tsMs > 0 && tsMs <= nowMs + 60000)
        ? Math.min(nowMs, tsMs)
        : nowMs;
    }
  }
}

/**
 * Calcula estado del LED por planta:
 * - Al cargar: verde-amarillo parpadeante (led-pending) hasta que llegue un dato diferente al inicial.
 * - Tras confirmar cambio nuevo: verde (< 5 min), amarillo (5-10 min), rojo (>= 10 min).
 */
function getPlantFreshnessMeta(plantId, entry, nowMs = Date.now()) {
  const todayStr = getLocalDateStr();
  const rec = ensurePlantLedSession(plantId, todayStr, entry, nowMs);
  const modMs = entry?.modifiedTime ? new Date(entry.modifiedTime).getTime() : NaN;
  const hasValidMod = Number.isFinite(modMs) && modMs > 0;
  const modStr = hasValidMod
    ? new Date(modMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  if (!rec.confirmedChange) {
    const waitMin = Math.max(0, (nowMs - rec.waitStartedMs) / 60000);
    const baseDetail = modStr ? ` · Última act.: ${modStr}` : '';
    if (waitMin >= 10) {
      return {
        cls: 'led-red',
        status: 'red',
        diffMin: waitMin,
        title: `Sin dato nuevo diferente al inicial (>=10 min)${baseDetail}`
      };
    }
    if (waitMin >= 5) {
      return {
        cls: 'led-yellow',
        status: 'yellow',
        diffMin: waitMin,
        title: `Sin dato nuevo diferente al inicial (${Math.floor(waitMin)} min · 5-10 min)${baseDetail}`
      };
    }
    return {
      cls: 'led-pending',
      status: 'pending',
      diffMin: waitMin,
      title: `Esperando dato nuevo diferente al inicial${baseDetail}`
    };
  }

  const refMs = rec.lastConfirmedAtMs || (hasValidMod ? modMs : NaN);
  if (!Number.isFinite(refMs) || refMs <= 0) {
    return { cls: 'led-red', status: 'red', diffMin: null, title: 'Sin actualización registrada hoy (>= 10 min)' };
  }
  const diffMin = Math.max(0, (nowMs - refMs) / 60000);
  const minsInt = Math.floor(diffMin);
  const timeStr = modStr || new Date(refMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (diffMin >= 10) {
    return {
      cls: 'led-red',
      status: 'red',
      diffMin,
      title: `Última act.: ${timeStr} (hace ${minsInt} min · >=10 min)`
    };
  }
  if (diffMin >= 5) {
    return {
      cls: 'led-yellow',
      status: 'yellow',
      diffMin,
      title: `Última act.: ${timeStr} (hace ${minsInt} min · 5-10 min)`
    };
  }
  return {
    cls: 'led-green',
    status: 'green',
    diffMin,
    title: `Dato nuevo confirmado: ${timeStr} (hace ${minsInt} min · al día)`
  };
}

function applyLedElementState(el, freshness) {
  if (!el) return;
  el.classList.remove('led-green', 'led-yellow', 'led-red', 'led-pending');
  el.classList.add(freshness.cls);
  el.title = freshness.title;
}

function updateAllPlantFreshnessLeds() {
  const todayStr = getLocalDateStr();
  const nowMs = Date.now();
  const targets = [
    { id: 'ALKA1', heroLed: 'ledHeroAlka1', chipLed: 'ledChipAlka1' },
    { id: 'ALKA2', heroLed: 'ledHeroAlka2', chipLed: 'ledChipAlka2' },
    { id: 'PALMAS', heroLed: 'ledHeroPalmas', chipLed: 'ledChipPalmas' }
  ];
  for (const t of targets) {
    const entry = getEffectivePlantEntry(t.id, todayStr);
    const freshness = getPlantFreshnessMeta(t.id, entry, nowMs);
    applyLedElementState(document.getElementById(t.heroLed), freshness);
    applyLedElementState(document.getElementById(t.chipLed), freshness);
    const blockLed = document.querySelector(`.plant-block[data-planta="${t.id}"] .pb-right .plant-led`);
    applyLedElementState(blockLed, freshness);
  }
}

// =============================================================================
// RENDERIZADO MÓVIL CAUCA
// =============================================================================
function getVisiblePlants() {
  return State.selectedPlant === 'TODAS' ? PLANTS : PLANTS.filter((p) => p.id === State.selectedPlant);
}

function getDayTotalForVisible(fecha) {
  let total = 0;
  let activos = 0;
  for (const p of getVisiblePlants()) {
    const entry = getEffectivePlantEntry(p.id, fecha);
    if (entry) {
      total += Number(entry.totalPlanta || 0);
      activos += (entry.galpones || []).filter((g) => g.totalProduccion > 0).length;
    }
  }
  return { total, activos };
}

const HERO_LAST_SHOWN = {
  fecha: null,
  scope: null,
  totalHoy: null,
  alka1: null,
  alka2: null,
  palmas: null
};
const HERO_FLASH_TIMERS = new WeakMap();

/**
 * Dispara animación visual temporal cuando cambia un valor numérico en la tarjeta hero.
 * Reinicia limpiamente la animación CSS si llegan actualizaciones seguidas.
 */
function triggerHeroChangeEffect(el) {
  if (!el) return;
  const prevTimer = HERO_FLASH_TIMERS.get(el);
  if (prevTimer) clearTimeout(prevTimer);

  el.classList.remove('val-changed');
  void el.offsetWidth;
  el.classList.add('val-changed');

  const tid = setTimeout(() => {
    el.classList.remove('val-changed');
    HERO_FLASH_TIMERS.delete(el);
  }, 1900);
  HERO_FLASH_TIMERS.set(el, tid);
}

/**
 * Actualiza el total y las 3 píldoras (ALKA 1, ALKA 2, PALMAS) disparando efecto solo cuando cambia el dato.
 */
function updateHeroMetricsUi(todayStr, scope, totalHoy, totalAlka1, totalAlka2, totalPalmas) {
  const elTotal = document.getElementById('lblHeroTotal');
  const elAlka1 = document.getElementById('lblHoyAlka1');
  const elAlka2 = document.getElementById('lblHoyAlka2');
  const elPalmas = document.getElementById('lblHoyPalmas');

  elAlka1.textContent = totalAlka1.toLocaleString();
  elAlka2.textContent = totalAlka2.toLocaleString();
  elPalmas.textContent = totalPalmas.toLocaleString();
  elTotal.textContent = totalHoy.toLocaleString();

  if (HERO_LAST_SHOWN.fecha === todayStr) {
    if (HERO_LAST_SHOWN.scope === scope && HERO_LAST_SHOWN.totalHoy !== totalHoy) {
      triggerHeroChangeEffect(elTotal);
    }
    if (HERO_LAST_SHOWN.alka1 !== totalAlka1) {
      triggerHeroChangeEffect(elAlka1.closest('.hp-pill'));
    }
    if (HERO_LAST_SHOWN.alka2 !== totalAlka2) {
      triggerHeroChangeEffect(elAlka2.closest('.hp-pill'));
    }
    if (HERO_LAST_SHOWN.palmas !== totalPalmas) {
      triggerHeroChangeEffect(elPalmas.closest('.hp-pill'));
    }
  }

  HERO_LAST_SHOWN.fecha = todayStr;
  HERO_LAST_SHOWN.scope = scope;
  HERO_LAST_SHOWN.totalHoy = totalHoy;
  HERO_LAST_SHOWN.alka1 = totalAlka1;
  HERO_LAST_SHOWN.alka2 = totalAlka2;
  HERO_LAST_SHOWN.palmas = totalPalmas;
}

/**
 * Construye las tarjetas y el resumen (total y fuente) para una sección de producción (PX1/PX2/PX3/Palmas).
 */
function buildPlantSectionRender(plant, section, byNum, totalPlanta, recentCutoff) {
  const cards = [];
  let sectionTotal = 0;
  let sectionDiff = 0;
  let mqttCount = 0;
  let driveCount = 0;

  for (let n = section.minGalpon; n <= section.maxGalpon; n++) {
    const g = byNum.get(n);
    const val = Number(g?.totalProduccion || 0);
    sectionTotal += val;

    const gSrc = g?.source || 'NONE';
    if (gSrc === 'MQTT') {
      mqttCount++;
      if (g?.diffVsDrive > 0) sectionDiff += g.diffVsDrive;
    } else if (gSrc === 'DRIVE') {
      driveCount++;
    }

    const pct = totalPlanta > 0 ? ((val / totalPlanta) * 100).toFixed(1) : '0.0';
    const recentTs = State.recentMqttChanges.get(`${plant.id}|${n}`) || 0;
    const isFlash = gSrc === 'MQTT' && recentTs > recentCutoff;
    const gTimeStr = g?.updatedAt
      ? new Date(g.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    const hasDiff = gSrc === 'MQTT' && g?.diffVsDrive > 0;
    const tagHtml = hasDiff
      ? `<span class="mgalpon-tag tag-mqtt">+${g.diffVsDrive.toLocaleString()}</span>`
      : '';
    let footerTxt = `${pct}% de ${plant.name}`;
    if (gSrc === 'MQTT') {
      footerTxt = `${pct}% · MQTT ${gTimeStr}`;
    } else if (gSrc === 'DRIVE') {
      footerTxt = `${pct}% · Archivo${gTimeStr ? ' ' + gTimeStr : ''}`;
    }

    cards.push(`
      <div class="mgalpon-card p-${plant.id} ${val === 0 ? 'zero' : ''} ${gSrc === 'MQTT' ? 'is-mqtt' : ''} ${isFlash ? 'mqtt-flash' : ''}">
        <div class="mgalpon-top">
          <span class="mgalpon-name">${escapeHtml(g?.nombreGalpon || `Galpón ${n}`)}</span>
          ${tagHtml}
        </div>
        <div class="mgalpon-val">${val.toLocaleString()}</div>
        <div class="mgalpon-bar"><div style="width:${Math.min(100, Number(pct))}%;background:${plant.color};"></div></div>
        <div class="mgalpon-pct ${gSrc === 'MQTT' ? 'is-mqtt-txt' : ''}">${escapeHtml(footerTxt)}</div>
      </div>
    `);
  }

  let sectionSource = 'NONE';
  if (mqttCount > 0 && driveCount > 0) sectionSource = 'MIX';
  else if (mqttCount > 0) sectionSource = 'MQTT';
  else if (driveCount > 0) sectionSource = 'DRIVE';

  return { cardsHtml: cards.join(''), total: sectionTotal, diff: sectionDiff, source: sectionSource };
}

function renderAll() {
  const todayStr = getLocalDateStr();
  const targetDates = getTarget8Dates(todayStr);
  const visiblePlants = getVisiblePlants();

  const todayAlka1 = getEffectivePlantEntry('ALKA1', todayStr);
  const todayAlka2 = getEffectivePlantEntry('ALKA2', todayStr);
  const todayPalmas = getEffectivePlantEntry('PALMAS', todayStr);

  const totalAlka1 = Number(todayAlka1?.totalPlanta || 0);
  const totalAlka2 = Number(todayAlka2?.totalPlanta || 0);
  const totalPalmas = Number(todayPalmas?.totalPlanta || 0);

  const { total: totalHoy } = getDayTotalForVisible(todayStr);

  let latestMod = null;
  let hasAnyMqttVisible = false;
  for (const p of visiblePlants) {
    const pEntry = getEffectivePlantEntry(p.id, todayStr);
    if (pEntry?.source === 'MQTT' || pEntry?.source === 'MIX') hasAnyMqttVisible = true;
    const mt = pEntry?.modifiedTime;
    if (mt && (!latestMod || mt > latestMod)) latestMod = mt;
  }

  const labelScope = State.selectedPlant === 'TODAS' ? 'SECCIONAL CAUCA' : visiblePlants[0].name;
  const modeLabel = State.hoySource === 'mqtt' ? 'MQTT' : State.hoySource === 'drive' ? 'ARCHIVOS' : 'AUTO';
  document.getElementById('lblHoyFecha').textContent = `${labelScope} · ${todayStr} · ${modeLabel}`;
  document.getElementById('lblExportHoyTitle').textContent = `Exportar reporte de Hoy (${labelScope})`;
  document.getElementById('lblUltimaHora').textContent = latestMod
    ? `${hasAnyMqttVisible ? 'MQTT' : 'Act.'} ${new Date(latestMod).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : '--:--';
  updateHeroMetricsUi(todayStr, State.selectedPlant, totalHoy, totalAlka1, totalAlka2, totalPalmas);
  updateAllPlantFreshnessLeds();

  const recentCutoff = Date.now() - 5500;

  // Render galpones por planta y secciones de producción (dividiendo PX1 y PX2 en ALKA 1)
  const blocksHtml = visiblePlants.map((plant) => {
    const entry = getEffectivePlantEntry(plant.id, todayStr);
    const totalP = Number(entry?.totalPlanta || 0);
    const badge = getSourceBadgeMeta(entry?.source);
    const freshness = getPlantFreshnessMeta(plant.id, entry);
    const byNum = new Map((entry?.galpones || []).map((g) => [g.numeroGalpon, g]));
    const sections = plant.sections || [{ key: plant.id, title: plant.prodLabel, rangeLabel: plant.rangeLabel, minGalpon: plant.minGalpon, maxGalpon: plant.maxGalpon }];
    const splitBySection = sections.length > 1;

    const renderedSections = sections.map((sec) => ({
      sec,
      rendered: buildPlantSectionRender(plant, sec, byNum, totalP, recentCutoff)
    }));
    const totalDiffP = renderedSections.reduce((s, item) => s + item.rendered.diff, 0);

    const sectionsHtml = renderedSections.map(({ sec, rendered }) => {
      if (!splitBySection) {
        return `<div class="galpones-mobile-grid">${rendered.cardsHtml}</div>`;
      }
      const secBadge = getSourceBadgeMeta(rendered.source);
      return `
        <div class="prod-subsection">
          <div class="prod-subhead">
            <span class="prod-sub-title">${escapeHtml(sec.title)} (${sec.rangeLabel})</span>
            <div class="prod-sub-right">
              <span class="src-pill ${secBadge.cls}">${secBadge.text}</span>
              <div class="pb-total-box">
                <div class="prod-sub-total">${rendered.total.toLocaleString()} huevos</div>
                ${rendered.diff > 0 ? `<div class="pb-diff">(+${rendered.diff.toLocaleString()})</div>` : ''}
              </div>
            </div>
          </div>
          <div class="galpones-mobile-grid">${rendered.cardsHtml}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="plant-block" data-planta="${plant.id}">
        <div class="plant-block-head">
          <div class="pb-title">
            <span class="pb-dot" style="background:${plant.color};"></span>
            <div class="pb-name-col">
              <span class="pb-name">${plant.name} (${plant.rangeLabel})</span>
              <span class="pb-prod-lbl">${escapeHtml(plant.prodLabel)}</span>
            </div>
          </div>
          <div class="pb-right">
            <span class="plant-led ${freshness.cls}" title="${escapeHtml(freshness.title)}"></span>
            <span class="src-pill ${badge.cls}">${badge.text}</span>
            <div class="pb-total-box">
              <div class="pb-total">${totalP.toLocaleString()} huevos</div>
              ${totalDiffP > 0 ? `<div class="pb-diff">(+${totalDiffP.toLocaleString()})</div>` : ''}
            </div>
          </div>
        </div>
        ${sectionsHtml}
      </div>
    `;
  }).join('');

  document.getElementById('contenedorGalponesHoy').innerHTML = blocksHtml;
  renderWeekView(targetDates, todayStr, visiblePlants, labelScope);
}

function renderWeekView(targetDates, todayStr, visiblePlants, labelScope) {
  const ascDates = [...targetDates].reverse();
  const labels = ascDates.map((f) => (f === todayStr ? 'Hoy' : f.slice(5)));

  if (State.chart) {
    State.chart.data.labels = labels;
    State.chart.data.datasets = visiblePlants.map((p) => ({
      label: p.name,
      data: ascDates.map((f) => Number(getEffectivePlantEntry(p.id, f)?.totalPlanta || 0)),
      backgroundColor: p.color,
      borderRadius: 4,
      maxBarThickness: 28
    }));
    State.chart.update();
  }

  const dayTotals = ascDates.map((f) => getDayTotalForVisible(f).total);
  const totalSemana = dayTotals.reduce((a, b) => a + b, 0);
  const diasConDato = dayTotals.filter((v) => v > 0).length;
  const promSemana = diasConDato > 0 ? Math.round(totalSemana / diasConDato) : 0;

  document.getElementById('lbl7DiasTitle').textContent = `${labelScope} · Hoy + 7 Días`;
  document.getElementById('lblRango7Dias').textContent = `${ascDates[0].slice(5)} → ${todayStr.slice(5)}`;
  document.getElementById('lblTotalSemana').textContent = totalSemana.toLocaleString();
  document.getElementById('lblPromSemana').textContent = promSemana.toLocaleString();
  document.getElementById('lblDiasCargados').textContent = `${diasConDato} / 8`;

  const listHtml = targetDates.map((f) => {
    const isToday = f === todayStr;
    const { total } = getDayTotalForVisible(f);

    const plantDetails = visiblePlants.map((p) => {
      const e = getEffectivePlantEntry(p.id, f);
      const pTotal = Number(e?.totalPlanta || 0);
      const byNum = new Map((e?.galpones || []).map((g) => [g.numeroGalpon, g.totalProduccion]));
      const cells = [];
      for (let n = p.minGalpon; n <= p.maxGalpon; n++) {
        cells.push(`<div class="day-detail-cell"><span>G${n}</span><strong>${Number(byNum.get(n) || 0).toLocaleString()}</strong></div>`);
      }
      return `
        <div class="day-plant-subhead">
          <span>${p.name}</span>
          <span>${pTotal.toLocaleString()}</span>
        </div>
        <div class="day-detail-grid">${cells.join('')}</div>
      `;
    }).join('');

    return `
      <div class="day-item ${isToday ? 'is-today' : ''}">
        <button class="day-row-btn" onclick="this.nextElementSibling.classList.toggle('hidden')">
          <div class="day-left">
            <strong>${isToday ? `${f} (Hoy)` : formatFriendlyDate(f)}</strong>
            <span>Toca para ver desglose</span>
          </div>
          <div class="day-right">
            <strong>${total.toLocaleString()}</strong>
            <span>huevos</span>
          </div>
        </button>
        <div class="day-detail hidden">${plantDetails}</div>
      </div>
    `;
  }).join('');

  document.getElementById('lista7Dias').innerHTML = listHtml;
}

function formatFriendlyDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return `${dias[d.getDay()]} ${dateStr}`;
}

function initChart() {
  const ctx = document.getElementById('chart7Dias').getContext('2d');
  State.chart = new Chart(ctx, {
    type: 'bar',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = Number(ctx.parsed?.y || 0);
              return ` ${ctx.dataset.label}: ${val.toLocaleString()} huevos`;
            },
            footer: (items) => {
              if (!items || items.length === 0) return '';
              const chart = items[0].chart;
              const idx = items[0].dataIndex;
              let total = 0;
              chart.data.datasets.forEach((ds, i) => {
                if (chart.isDatasetVisible(i)) {
                  total += Number(ds.data[idx] || 0);
                }
              });
              return `Total: ${total.toLocaleString()} huevos`;
            }
          }
        }
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' } } },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { font: { size: 10 }, callback: (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v) }
        }
      }
    }
  });
}

// =============================================================================
// EXPORTACIONES (HOY Y DISPONIBLES -> PLANO CSV Y EXCEL XLSX)
// =============================================================================
function getRowsForExport(onlyToday) {
  const todayStr = getLocalDateStr();
  const dates = onlyToday ? [todayStr] : getTarget8Dates(todayStr);
  const visiblePlants = getVisiblePlants();
  const entries = [];

  for (const fecha of dates) {
    for (const p of visiblePlants) {
      const entry = getEffectivePlantEntry(p.id, fecha);
      if (entry && entry.source !== 'NONE' && (entry.galpones?.length > 0 || entry.totalPlanta > 0)) {
        entries.push(entry);
      }
    }
  }
  return entries.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.planta.localeCompare(b.planta));
}

function exportPlainCsv(onlyToday) {
  const entries = getRowsForExport(onlyToday);
  if (entries.length === 0) {
    showToast('No hay datos para exportar.', 'error');
    return;
  }

  const sep = document.getElementById('selectCsvSep').value || ',';
  const lines = [['Planta', 'Fecha', 'Galpon', 'Codigo_Galpon', 'Nombre_Galpon', 'Total_Produccion'].join(sep)];

  const byDate = new Map();
  for (const e of entries) {
    if (!byDate.has(e.fecha)) byDate.set(e.fecha, []);
    byDate.get(e.fecha).push(e);
  }

  for (const fecha of Array.from(byDate.keys()).sort()) {
    let totalCauca = 0;
    for (const dayEntry of byDate.get(fecha)) {
      for (const g of (dayEntry.galpones || [])) {
        lines.push([dayEntry.planta, fecha, g.numeroGalpon, g.codigoGalpon, g.nombreGalpon, g.totalProduccion].join(sep));
      }
      lines.push([dayEntry.planta, fecha, 'SUBTOTAL', `TOTAL_${dayEntry.planta}`, `TOTAL ${dayEntry.planta}`, dayEntry.totalPlanta].join(sep));
      totalCauca += Number(dayEntry.totalPlanta || 0);
    }
    lines.push(['CAUCA', fecha, 'TOTAL', 'TOTAL_CAUCA', 'TOTAL SECCIONAL CAUCA', totalCauca].join(sep));
  }

  const todayStr = getLocalDateStr();
  const filename = onlyToday
    ? `KIKES_CAUCA_Hoy_${State.selectedPlant}_${todayStr}.csv`
    : `KIKES_CAUCA_7Dias_${State.selectedPlant}_${todayStr}.csv`;

  triggerDownload(new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' }), filename);
  showToast(`Plano exportado: ${filename}`, 'success');
}

function exportExcel(onlyToday) {
  const entries = getRowsForExport(onlyToday);
  if (entries.length === 0) {
    showToast('No hay datos para exportar.', 'error');
    return;
  }
  if (typeof XLSX === 'undefined') {
    showToast('Librería XLSX no disponible.', 'error');
    return;
  }

  const byDate = new Map();
  const detalle = [];
  for (const e of entries) {
    if (!byDate.has(e.fecha)) byDate.set(e.fecha, { Fecha: e.fecha, ALKA_1: 0, ALKA_2: 0, ALKA_PALMAS: 0, Total_Cauca: 0 });
    const sumRow = byDate.get(e.fecha);
    const val = Number(e.totalPlanta || 0);
    if (e.planta === 'ALKA1') sumRow.ALKA_1 += val;
    else if (e.planta === 'ALKA2') sumRow.ALKA_2 += val;
    else if (e.planta === 'PALMAS') sumRow.ALKA_PALMAS += val;
    sumRow.Total_Cauca += val;

    for (const g of (e.galpones || [])) {
      detalle.push({
        Planta: e.planta,
        Fecha: e.fecha,
        Galpon: g.numeroGalpon,
        Codigo: g.codigoGalpon,
        Nombre: g.nombreGalpon,
        Total_Produccion: g.totalProduccion
      });
    }
  }

  const resumen = Array.from(byDate.values()).sort((a, b) => b.Fecha.localeCompare(a.Fecha));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Resumen_Cauca');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalle), 'Detalle_Galpones');

  const todayStr = getLocalDateStr();
  const filename = onlyToday
    ? `KIKES_CAUCA_Hoy_${State.selectedPlant}_${todayStr}.xlsx`
    : `KIKES_CAUCA_7Dias_${State.selectedPlant}_${todayStr}.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast(`Excel exportado: ${filename}`, 'success');
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// =============================================================================
// EVENTOS
// =============================================================================
function initEventListeners() {
  document.getElementById('btnGoogleLogin').addEventListener('click', loginWithGoogle);
  document.getElementById('btnLogout').addEventListener('click', logoutGoogle);
  document.getElementById('btnRefreshHoy').addEventListener('click', () => refrescarSoloHoy(true));
  document.getElementById('btnRecargar8Dias').addEventListener('click', () => cargarInicio8Dias(true));

  document.querySelectorAll('#hoySourceSeg .sseg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const src = btn.dataset.source;
      if (src !== 'auto' && src !== 'mqtt' && src !== 'drive') return;
      State.hoySource = src;
      localStorage.setItem(CONFIG.STORAGE_KEYS.HOY_SOURCE, src);
      syncHoySourceButtons();
      absorbPendingPlantBaselines();
      renderAll();
      const desc = src === 'mqtt' ? 'Hoy: solo MQTT' : src === 'drive' ? 'Hoy: solo Archivos Drive' : 'Hoy: Auto (MQTT si llega > Archivos)';
      showToast(desc, 'info');
    });
  });

  document.querySelectorAll('#plantBar .pchip').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#plantBar .pchip').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      State.selectedPlant = btn.dataset.planta;
      renderAll();
    });
  });

  document.querySelectorAll('.bnav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bnav-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.m-view').forEach((v) => v.classList.add('hidden'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.view).classList.remove('hidden');
      if (btn.dataset.view === 'view7Dias' && State.chart) State.chart.resize();
    });
  });

  document.getElementById('btnQuickHoyCsv').addEventListener('click', () => exportPlainCsv(true));
  document.getElementById('btnQuickHoyExcel').addEventListener('click', () => exportExcel(true));
  document.getElementById('btnQuickDispCsv').addEventListener('click', () => exportPlainCsv(false));
  document.getElementById('btnQuickDispExcel').addEventListener('click', () => exportExcel(false));
  document.getElementById('btnExpHoyCsv').addEventListener('click', () => exportPlainCsv(true));
  document.getElementById('btnExpHoyExcel').addEventListener('click', () => exportExcel(true));
  document.getElementById('btnExpDispCsv').addEventListener('click', () => exportPlainCsv(false));
  document.getElementById('btnExpDispExcel').addEventListener('click', () => exportExcel(false));

  document.getElementById('btnGuardarConfig').addEventListener('click', () => {
    State.folders = {
      ALKA1: cleanFolderId(document.getElementById('inputFolderAlka1').value) || PLANTS[0].defaultFolderId,
      ALKA2: cleanFolderId(document.getElementById('inputFolderAlka2').value) || PLANTS[1].defaultFolderId,
      PALMAS: cleanFolderId(document.getElementById('inputFolderPalmas').value) || PLANTS[2].defaultFolderId
    };
    const poll = Math.max(0, parseInt(document.getElementById('selectPollSec').value || '60', 10));
    State.pollSec = poll;
    localStorage.setItem(CONFIG.STORAGE_KEYS.FOLDERS, JSON.stringify(State.folders));
    localStorage.setItem(CONFIG.STORAGE_KEYS.POLL_SEC, String(poll));
    restartPollTimer();
    showToast('Configuración Drive guardada.', 'success');
  });

  document.getElementById('btnGuardarMqtt')?.addEventListener('click', () => {
    State.mqttCfg = {
      enabled: !!document.getElementById('chkMqttEnabled')?.checked,
      brokerUrl: document.getElementById('inputMqttBroker')?.value.trim() || DEFAULT_MQTT_BROKER,
      topics: {
        PX1: document.getElementById('inputMqttTopicPx1')?.value.trim() || MQTT_TOPIC_DEFS[0].defaultTopic,
        PX2: document.getElementById('inputMqttTopicPx2')?.value.trim() || MQTT_TOPIC_DEFS[1].defaultTopic,
        PX3: document.getElementById('inputMqttTopicPx3')?.value.trim() || MQTT_TOPIC_DEFS[2].defaultTopic,
        PXPALMAS: document.getElementById('inputMqttTopicPalmas')?.value.trim() || MQTT_TOPIC_DEFS[3].defaultTopic
      }
    };
    localStorage.setItem(CONFIG.STORAGE_KEYS.MQTT_CFG, JSON.stringify(State.mqttCfg));
    connectMqttClient();
    showToast('Configuración MQTT guardada y reconectando.', 'success');
  });

  document.getElementById('btnReconectarMqtt')?.addEventListener('click', () => {
    connectMqttClient();
    showToast('Reconectando MQTT...', 'info');
  });
}

function restartPollTimer() {
  if (State.pollTimer) { clearInterval(State.pollTimer); State.pollTimer = null; }
  if (State.pollSec > 0) {
    State.pollTimer = setInterval(() => {
      if (State.accessToken && Date.now() < State.tokenExpiry) refrescarSoloHoy(false);
    }, State.pollSec * 1000);
  }
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 250); }, 2800);
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
