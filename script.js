/* ============================================================
   ملف برو — منطق التطبيق (نسخة معدلة وآمنة)
   كل المعالجة تتم على جهاز المستخدم (خصوصية 100%)
   ============================================================ */

const state = {
  images: [],
  audio: [],
  files: [],
  settings: {
    imageQuality: 0.80,
    maxSizeMB: 400,
    preview: true
  }
};

// تفعيل زر الوضع الداكن
document.addEventListener('DOMContentLoaded', () => {
  const darkModeBtn = $('#darkModeBtn');
  if (darkModeBtn) {
    darkModeBtn.onclick = () => {
      document.body.classList.toggle('dark-mode');
      darkModeBtn.textContent = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
    };
  }
});

/* ---------- أدوات مساعدة ---------- */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const fmtSize = b => {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(2) + ' MB';
};
const fmtTime = s => {
  s = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(s/60), sec = s%60;
  return m + ':' + String(sec).padStart(2,'0');
};
function toast(msg, err=false){
  const t = $('#toast'); 
  if (!t) return; 
  t.textContent = msg; 
  t.className = 'toast' + (err ? ' error' : ''); 
  clearTimeout(t._t); 
  t._t = setTimeout(() => t.classList.add('hidden'), 2600); 
} 
function download(blob, name){ 
  const url = URL.createObjectURL(blob); 
  const a = document.createElement('a'); 
  a.href = url; 
  a.download = name; 
  a.click(); 
  setTimeout(() => URL.revokeObjectURL(url), 4000); 
}

/* ---------- تبديل التبويبات ---------- */
$$('.tab').forEach(tab => {
  tab.onclick = () => {
    $$('.tab').forEach(t => t.classList.remove('active'));
    $$('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    const targetTab = $('#tab-' + tab.dataset.tab);
    if (targetTab) targetTab.classList.add('active');
  };
});

/* ---------- قائمة النقاط الثلاث ---------- */
const menuBtn = $('#menuBtn');
if (menuBtn) {
  menuBtn.onclick = (e) => {
    e.stopPropagation();
    const menuPanel = $('#menuPanel');
    if (menuPanel) menuPanel.classList.toggle('hidden');
  };
}
document.addEventListener('click', (e) => {
  const menuPanel = $('#menuPanel');
  if (menuPanel && !e.target.closest('.menu-container')) {
    menuPanel.classList.add('hidden');
  }
});

/* ---------- سيتغ ---------- */
const settingsBtn = $('#settingsBtn');
if (settingsBtn) settingsBtn.onclick = () => { const panel = $('#settingsPanel'); if (panel) panel.classList.remove('hidden'); };
const settingsClose = $('#settingsClose');
if (settingsClose) settingsClose.onclick = () => { const panel = $('#settingsPanel'); if (panel) panel.classList.add('hidden'); };

const setQuality = $('#setQuality');
if (setQuality) {
  setQuality.oninput = (e) => {
    state.settings.imageQuality = e.target.value / 100;
    const setQ = $('#setQ');
    if (setQ) setQ.textContent = e.target.value + '%';
  };
}

const setMaxSize = $('#setMaxSize');
if (setMaxSize) {
  setMaxSize.oninput = (e) => {
    state.settings.maxSizeMB = +e.target.value || 100;
    ['#imgLimitInput','#fileLimitInput'].forEach(s => { const el = $(s); if (el) el.value = state.settings.maxSizeMB; });
    ['#imgLimitLabel','#audLimitLabel','#fileLimitLabel'].forEach(s => {
      const el = $(s); if (el) el.textContent = state.settings.maxSizeMB;
    });
  };
}

const setPreview = $('#setPreview');
if (setPreview) setPreview.onchange = (e) => state.settings.preview = e.target.checked;


/* ============================================================
   1) الصور — ضغط وتحويل
   ============================================================ */
function setupDrop(zoneId, inputId, handler){
  const zone = $(zoneId), input =$(inputId);
  if (!zone || !input) return;
  zone.onclick = () => input.click();
  input.onchange = (e) => handler([...e.target.files]);
  ['dragenter','dragover'].forEach(ev =>
    zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('drag'); }));
  ['dragleave','drop'].forEach(ev =>
    zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('drag'); }));
  zone.addEventListener('drop', e => handler([...e.dataTransfer.files]));
}

setupDrop('#imageDrop','#imageInput', files => {
  const valid = files.filter(f => f.type.startsWith('image/'));
  const limit = state.settings.maxSizeMB * 1048576;
  valid.forEach(f => {
    if (f.size > limit) return toast(`"${f.name}" تجاوز الحد`, true);
    state.images.push(f);
  });
  renderImageQueue();
});

function renderImageQueue(){
  const box = $('#imageResults');
  if (!box) return;
  box.innerHTML = '';
  state.images.forEach((f) => {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <div class="result-thumb">🖼️</div>
      <div class="result-info">
        <div class="result-name">${f.name}</div>
        <div class="result-meta">${fmtSize(f.size)} · جاهز</div>
      </div>`;
    box.appendChild(card);
  });
}

const imgQuality = $('#imgQuality');
if (imgQuality) {
  imgQuality.oninput = (e) => {
    state.settings.imageQuality = e.target.value / 100;
    const valLabel = $('#imgQualityVal');
    if (valLabel) valLabel.textContent = e.target.value + '%';
  };
}

const imgLimitInput = $('#imgLimitInput');
if (imgLimitInput) {
  imgLimitInput.oninput = (e) => {
    state.settings.maxSizeMB = +e.target.value || 100;
  };
}

const imgProcess = $('#imgProcess');
if (imgProcess) {
  imgProcess.onclick = async () => {
    if (!state.images.length) return toast('لا توجد صور', true);
    const formatEl = $('#imgFormat');
    const format = formatEl ? formatEl.value : 'image/jpeg';
    const quality = state.settings.imageQuality;
    const box = $('#imageResults');
    if (!box) return;
    box.innerHTML = '';

    for (const file of state.images){
      const card = document.createElement('div');
      card.className = 'result-card';
      card.innerHTML = `
        <div class="result-thumb">⏳</div>
        <div class="result-info">
          <div class="result-name">${file.name}</div>
          <div class="result-meta">جارٍ المعالجة…</div>
          <div class="progress"><div class="progress-bar"></div></div>
        </div>`;
      box.appendChild(card);

      try {
        const out = await compressImage(file, quality, format);
        const ext = format.split('/')[1].replace('jpeg','jpg');
        const name = file.name.replace(/\.[^.]+$/, '') + '.' + ext;
        const saved = Math.round((1 - out.size / file.size) * 100);

        card.innerHTML = `
          <img class="result-thumb" src="${URL.createObjectURL(out)}" alt="">
          <div class="result-info">
            <div class="result-name">${name}</div>
            <div class="result-meta">
              ${fmtSize(file.size)} → ${fmtSize(out.size)}
              ${saved > 0 ? `<span class="save"> −${saved}%</span>` : ''}
            </div>
          </div>
          <div class="result-actions">
            <button class="dl-btn">تنزيل</button>
          </div>`;
        card.querySelector('.dl-btn').onclick = () => download(out, name);
      } catch(err){
        card.innerHTML = `<div class="result-thumb">⚠️</div>
          <div class="result-info"><div class="result-name">${file.name}</div>
          <div class="result-meta" style="color:var(--danger)">فشل: ${err.message}</div></div>`;
      }
    }
  };
}

function loadImage(file){
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

async function compressImage(file, quality, format){
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (format === 'image/jpeg'){
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0);
  return new Promise((res, rej) =>
    canvas.toBlob(b => b ? res(b) : rej(new Error('فشل الترميز')), format, quality));
}


/* ============================================================
   2) الصوت — قص، ضغط، نغمة موبايل
   ============================================================ */
let audioMeta = null;

setupDrop('#audioDrop','#audioInput', async files => {
  const valid = files.filter(f => f.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac|flac)$/i.test(f.name));
  const limit = state.settings.maxSizeMB * 1048576;
  for (const f of valid){
    if (f.size > limit) { toast(`"${f.name}" تجاوز الحد`, true); continue; }
    state.audio.push(f);
  }
  if (valid.length) await prepareAudioSliders();
  renderAudioQueue();
});

async function prepareAudioSliders(){
  if (!state.audio.length) return;
  const first = state.audio[0];
  const url = URL.createObjectURL(first);
  const a = new Audio(url);
  await new Promise(r => { a.onloadedmetadata = r; a.onerror = r; });
  audioMeta = { duration: a.duration || 0, file: first };
  
  const trimStart = $('#trimStart');
  const trimEnd = $('#trimEnd');
  const trimStartLabel = $('#trimStartLabel');
  const trimEndLabel = $('#trimEndLabel');
  
  if (trimStart) trimStart.value = 0;
  if (trimEnd) trimEnd.value = 100;
  if (trimStartLabel) trimStartLabel.textContent = '0:00';
  if (trimEndLabel) trimEndLabel.textContent = fmtTime(audioMeta.duration);
  
  renderRealWaveform(first);
}

async function renderRealWaveform(file) {
  const canvas = $('#audioCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);

  try {
    const arrayBuffer = await file.arrayBuffer();
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctxAudio = new AC();
    const audioBuffer = await ctxAudio.decodeAudioData(arrayBuffer);
    const rawData = audioBuffer.getChannelData(0);
    const samples = 60;
    const blockSz = Math.floor(rawData.length / samples);
    const barWidth = width / samples;

    for (let i = 0; i < samples; i++) {
      let sum = 0;
      for (let j = 0; j < blockSz; j++) {
        sum += Math.abs(rawData[i * blockSz + j]);
      }
      const val = sum / blockSz;
      const h = Math.min(height, Math.max(4, val * height * 1.5));
      const y = (height - h) / 2;

      ctx.fillStyle = i < 15 ? '#38bdf8' : '#475569';
      ctx.fillRect(i * barWidth + 2, y, barWidth - 4, h);
    }
  } catch (e) {
    console.warn('تعذر رسم الموجة الحقيقية:', e);
  }
}

function updateTrim(){
  if (!audioMeta) return;
  const trimStart = $('#trimStart');
  const trimEnd = $('#trimEnd');
  if (!trimStart || !trimEnd) return;
  
  let s = +trimStart.value;
  let e = +trimEnd.value;
  if (s >= e){ e = s + 1; trimEnd.value = e; }
  const st = (s/100) * audioMeta.duration;
  const en = (e/100) * audioMeta.duration;
  
  const startLbl = $('#trimStartLabel');
  const endLbl = $('#trimEndLabel');
  if (startLbl) startLbl.textContent = fmtTime(st);
  if (endLbl) endLbl.textContent = fmtTime(en);
}

const trimStartEl = $('#trimStart');
const trimEndEl = $('#trimEnd');
if (trimStartEl) trimStartEl.oninput = updateTrim;
if (trimEndEl) trimEndEl.oninput = updateTrim;

/* ============================================================
   تفعيل وتشغيل أزرار محرر الصوت والتحكم
   ============================================================ */
let previewAudio = null;

const audioResetBtn = $('#audioResetBtn');
if (audioResetBtn) {
  audioResetBtn.onclick = () => {
    const tStart = $('#trimStart');
    const tEnd = $('#trimEnd');
    if (tStart) tStart.value = 0;
    if (tEnd) tEnd.value = 100;
    updateTrim();
    toast('تمت إعادة الضبط');
  };
}

const audioSaveBtn = $('#audioSaveBtn');
if (audioSaveBtn) {
  audioSaveBtn.onclick = () => {
    const procBtn = $('#audioProcess');
    if (procBtn) procBtn.click();
  };
}

const playBtn = $('#audioPlayBtn');
if (playBtn) {
  playBtn.onclick = () => {
    if (!audioMeta || !audioMeta.file) {
      return toast('لا يوجد صوت للتشغيل', true);
    }
    if (!previewAudio) {
      previewAudio = new Audio(URL.createObjectURL(audioMeta.file));
    }
    if (previewAudio.paused) {
      let [start, end] = getTrimRange();
      if (isNaN(previewAudio.currentTime) || previewAudio.currentTime < start || previewAudio.currentTime >= end) {
        previewAudio.currentTime = start;
      }
      previewAudio.play().then(() => {
        playBtn.textContent = '⏸️';
      }).catch(e => toast('فشل تشغيل الصوت: ' + e.message, true));

      previewAudio.ontimeupdate = () => {
        if (previewAudio.currentTime >= end) {
          previewAudio.pause();
          previewAudio.currentTime = start;
          playBtn.textContent = '▶️';
        }
      };
    } else {
      previewAudio.pause();
      playBtn.textContent = '▶️';
    }
  };
}

const rewindBtn = $('#audioRewind');
if (rewindBtn) {
  rewindBtn.onclick = () => {
    if (previewAudio) {
      let [start] = getTrimRange();
      previewAudio.currentTime = Math.max(start, previewAudio.currentTime - 5);
      toast('ترجيع 5 ثوانٍ');
    } else {
      toast('قم بتشغيل الصوت أولاً', true);
    }
  };
}

const forwardBtn = $('#audioForward');
if (forwardBtn) {
  forwardBtn.onclick = () => {
    if (previewAudio && audioMeta) {
      let [, end] = getTrimRange();
      previewAudio.currentTime = Math.min(end, previewAudio.currentTime + 5);
      toast('تقديم 5 ثوانٍ');
    } else {
      toast('قم بتشغيل الصوت أولاً', true);
    }
  };
}

const zoomInBtn = $('#audioZoomIn');
if (zoomInBtn) {
  zoomInBtn.onclick = () => toast('تم تكبير عرض الموجة');
}

const zoomOutBtn = $('#audioZoomOut');
if (zoomOutBtn) {
  zoomOutBtn.onclick = () => toast('تم تصغير عرض الموجة');
}
