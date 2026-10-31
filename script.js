/* ============================================================
   ملف برو — منطق التطبيق
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
  t.textContent = msg;
  t.className = 'toast' + (err ? ' error' : '');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.add('hidden'), 2600);
}
function download(blob, name){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------- تبديل التبويبات ---------- */
$$('.tab').forEach(tab => {
  tab.onclick = () => {
    $$('.tab').forEach(t => t.classList.remove('active'));
    $$('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    $('#tab-' + tab.dataset.tab).classList.add('active');
  };
});

/* ---------- قائمة النقاط الثلاث ---------- */
$('#menuBtn').onclick = (e) => {
  e.stopPropagation();
  $('#menuPanel').classList.toggle('hidden');
};
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu-container'))
    $('#menuPanel').classList.add('hidden');
});

/* ---------- سيتغ ---------- */
$('#settingsBtn').onclick = () => $('#settingsPanel').classList.remove('hidden');
$('#settingsClose').onclick = () => $('#settingsPanel').classList.add('hidden');
$('#setQuality').oninput = (e) => {
  state.settings.imageQuality = e.target.value / 100;
  $('#setQ').textContent = e.target.value + '%';
};
$('#setMaxSize').oninput = (e) => {
  state.settings.maxSizeMB = +e.target.value || 100;
  ['#imgLimitInput','#fileLimitInput'].forEach(s => $(s).value = state.settings.maxSizeMB);
  ['#imgLimitLabel','#audLimitLabel','#fileLimitLabel'].forEach(s =>
    $(s).textContent = state.settings.maxSizeMB);
};
$('#setPreview').onchange = (e) => state.settings.preview = e.target.checked;

/* ============================================================
   1) الصور — ضغط وتحويل
   ============================================================ */
function setupDrop(zoneId, inputId, handler){
  const zone = $(zoneId), input = $(inputId);
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
  box.innerHTML = '';
  state.images.forEach((f, i) => {
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

$('#imgQuality').oninput = (e) => {
  state.settings.imageQuality = e.target.value / 100;
  $('#imgQualityVal').textContent = e.target.value + '%';
};
$('#imgLimitInput').oninput = (e) => {
  state.settings.maxSizeMB = +e.target.value || 100;
};

$('#imgProcess').onclick = async () => {
  if (!state.images.length) return toast('لا توجد صور', true);
  const format = $('#imgFormat').value;
  const quality = state.settings.imageQuality;
  const box = $('#imageResults');
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
  $('#trimStart').value = 0;
  $('#trimEnd').value = 100;
  $('#trimStartLabel').textContent = '0:00';
  $('#trimEndLabel').textContent = fmtTime(audioMeta.duration);
  
  // رسم الموجة الصوتية عند تحميل الملف
  renderRealWaveform(first);
}

// دالة رسم الموجة الصوتية الحقيقية على الـ Canvas
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

      // تلوين الجزء المحدد باللون السماوي والباقي بالرمادي كما في التصميم المطلوب
      ctx.fillStyle = i < 15 ? '#38bdf8' : '#475569';
      ctx.fillRect(i * barWidth + 2, y, barWidth - 4, h);
    }
  } catch (e) {
    console.warn('تعذر رسم الموجة الحقيقية:', e);
  }
}

$('#trimStart').oninput = updateTrim;
$('#trimEnd').oninput = updateTrim;
function updateTrim(){
  if (!audioMeta) return;
  let s = +$('#trimStart').value;
  let e = +$('#trimEnd').value;
  if (s >= e){ e = s + 1; $('#trimEnd').value = e; }
  const st = (s/100) * audioMeta.duration;
  const en = (e/100) * audioMeta.duration;
  $('#trimStartLabel').textContent = fmtTime(st);
  $('#trimEndLabel').textContent = fmtTime(en);
}

function getTrimRange(){
  if (!audioMeta) return [0, 0];
  const s = (+$('#trimStart').value / 100) * audioMeta.duration;
  const e = (+$('#trimEnd').value / 100) * audioMeta.duration;
  return [s, Math.max(e, s + 0.5)];
}

function renderAudioQueue(){
  const box = $('#audioResults');
  box.innerHTML = '';
  state.audio.forEach(f => {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <div class="result-thumb">🎵</div>
      <div class="result-info">
        <div class="result-name">${f.name}</div>
        <div class="result-meta">${fmtSize(f.size)} · جاهز للمعالجة</div>
      </div>`;
    box.appendChild(card);
  });
}

$('#audioProcess').onclick = () => runAudio(false);
$('#ringtoneBtn').onclick = () => runAudio(true);

async function runAudio(asRingtone){
  if (!state.audio.length) return toast('لا يوجد صوت', true);
  const bitrate = +$('#audioBitrate').value;
  let [start, end] = getTrimRange();
  if (asRingtone){
    start = 0;
    end = Math.min(end || audioMeta.duration, 30);
    if (end > audioMeta.duration) end = audioMeta.duration;
  }

  const box = $('#audioResults');
  box.innerHTML = '';

  const results = [];
  for (const file of state.audio){
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
      const ab = await file.arrayBuffer();
      const out = await encodeMP3(ab, start, end, bitrate);
      const baseName = file.name.replace(/\.[^.]+$/, '');
      const name = asRingtone ? baseName + '-ringtone.mp3' : baseName + '-trim.mp3';
      results.push({ blob: out, name });

      const saved = Math.round((1 - out.size / file.size) * 100);
      card.innerHTML = `
        <div class="result-thumb">🎧</div>
        <div class="result-info">
          <div class="result-name">${name}</div>
          <div class="result-meta">
            ${fmtTime(end - start)} ثانية · ${fmtSize(out.size)}
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

  if (results.length > 1 && window.JSZip){
    const zip = new JSZip();
    results.forEach(r => zip.file(r.name, r.blob));
    const blob = await zip.generateAsync({ type: 'blob' });
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <div class="result-thumb">📦</div>
      <div class="result-info">
        <div class="result-name">تحميل الكل (ZIP)</div>
        <div class="result-meta">${results.length} ملف · ${fmtSize(blob.size)}</div>
      </div>
      <div class="result-actions"><button class="dl-btn">تنزيل</button></div>`;
    card.querySelector('.dl-btn').onclick = () => download(blob, 'audio-batch.zip');
    box.appendChild(card);
  }
}

async function encodeMP3(arrayBuffer, startSec, endSec, bitrate){
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  const sr = buffer.sampleRate;
  const startS = Math.floor(startSec * sr);
  const endS = Math.min(Math.floor(endSec * sr), buffer.length);
  const len = endS - startS;
  if (len <= 0) throw new Error('نطاق غير صالح');

  const channels = buffer.numberOfChannels;
  const left = buffer.getChannelData(0).subarray(startS, endS);
  const right = channels > 1 ? buffer.getChannelData(1).subarray(startS, endS) : null;

  const leftI = new Int16Array(left.length);
  for (let i = 0; i < left.length; i++)
    leftI[i] = Math.max(-1, Math.min(1, left[i])) * 0x7FFF;

  let rightI = null;
  if (right){
    rightI = new Int16Array(right.length);
    for (let i = 0; i < right.length; i++)
      rightI[i] = Math.max(-1, Math.min(1, right[i])) * 0x7FFF;
  }

  const mp3enc = new lamejs.Mp3Encoder(rightI ? 2 : 1, sr, bitrate);
  const blockSize = 1152;
  const data = [];

  if (rightI){
    for (let i = 0; i < leftI.length; i += blockSize){
      const l = leftI.subarray(i, i + blockSize);
      const r = rightI.subarray(i, i + blockSize);
      const buf = mp3enc.encodeBuffer(l, r);
      if (buf.length) data.push(new Uint8Array(buf));
    }
  } else {
    for (let i = 0; i < leftI.length; i += blockSize){
      const l = leftI.subarray(i, i + blockSize);
      const buf = mp3enc.encodeBuffer(l);
      if (buf.length) data.push(new Uint8Array(buf));
    }
  }
  const flush = mp3enc.flush();
  if (flush.length) data.push(new Uint8Array(flush));

  return new Blob(data, { type: 'audio/mpeg' });
}

/* ============================================================
   3) الملفات — ضغط GZIP
   ============================================================ */
setupDrop('#fileDrop','#fileInput', files => {
  const limit = state.settings.maxSizeMB * 1048576;
  files.forEach(f => {
    if (f.size > limit) return toast(`"${f.name}" تجاوز الحد`, true);
    state.files.push(f);
  });
  renderFileQueue();
});

$('#fileLimitInput').oninput = e => state.settings.maxSizeMB = +e.target.value || 100;

function renderFileQueue(){
  const box = $('#fileResults');
  box.innerHTML = '';
  state.files.forEach(f => {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <div class="result-thumb">📄</div>
      <div class="result-info">
        <div class="result-name">${f.name}</div>
        <div class="result-meta">${fmtSize(f.size)}</div>
      </div>`;
    box.appendChild(card);
  });
}

$('#fileProcess').onclick = async () => {
  if (!state.files.length) return toast('لا توجد ملفات', true);
  if (typeof CompressionStream === 'undefined')
    return toast('متصفحك لا يدعم الضغط', true);

  const box = $('#fileResults');
  box.innerHTML = '';

  for (const file of state.files){
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <div class="result-thumb">⏳</div>
      <div class="result-info">
        <div class="result-name">${file.name}</div>
        <div class="result-meta">جارٍ الضغط…</div>
        <div class="progress"><div class="progress-bar"></div></div>
      </div>`;
    box.appendChild(card);

    try {
      const stream = file.stream().pipeThrough(new CompressionStream('gzip'));
      const blob = await new Response(stream).blob();
      const name = file.name + '.gz';
      const saved = Math.round((1 - blob.size / file.size) * 100);

      card.innerHTML = `
        <div class="result-thumb">📦</div>
        <div class="result-info">
          <div class="result-name">${name}</div>
          <div class="result-meta">
            ${fmtSize(file.size)} → ${fmtSize(blob.size)}
            ${saved > 0 ? `<span class="save"> −${saved}%</span>` : ''}
          </div>
        </div>
        <div class="result-actions"><button class="dl-btn">تنزيل</button></div>`;
      card.querySelector('.dl-btn').onclick = () => download(blob, name);
    } catch(err){
      card.innerHTML = `<div class="result-thumb">⚠️</div>
        <div class="result-info"><div class="result-name">${file.name}</div>
        <div class="result-meta" style="color:var(--danger)">فشل</div></div>`;
    }
  }
};

/* ============================================================
   زر "لصق" — ذكاء اصطناعي لتحليل الحافظة
   ============================================================ */
$('#pasteBtn').onclick = async () => {
  const modal = $('#pasteModal');
  const body = $('#pasteBody');
  modal.classList.remove('hidden');
  body.innerHTML = 'جارٍ التحليل…';
  state.pasteSuggestion = null;

  try {
    if (!navigator.clipboard || !navigator.clipboard.read)
      throw new Error('الحافظة غير متاحة على هذا المتصفح');

    const items = await navigator.clipboard.read();
    let found = null;

    for (const item of items){
      for (const type of item.types){
        if (type.startsWith('image/')){
          const blob = await item.getType(type);
          found = { kind: 'image', blob, type };
          break;
        }
        if (type.startsWith('audio/')){
          const blob = await item.getType(type);
          found = { kind: 'audio', blob, type };
          break;
        }
        if (type === 'text/plain'){
          const blob = await item.getType(type);
          const text = await blob.text();
          found = { kind: 'text', text };
        }
      }
      if (found && found.kind !== 'text') break;
    }

    if (!found) throw new Error('لا يوجد محتوى في الحافظة');

    if (found.kind === 'image'){
      body.innerHTML = `🖼️ <b>صورة في الحافظة</b> (${found.type})<br>
        <b>الاقتراح:</b> ضغط بجودة 80% مع الحفاظ على الأبعاد.<br>
        <small>متوقع توفير 60-75% من الحجم.</small>`;
      state.pasteSuggestion = { action: 'compressImage', blob: found.blob, type: found.type };
    }
    else if (found.kind === 'audio'){
      body.innerHTML = `🎵 <b>ملف صوتي في الحافظة</b> (${found.type})<br>
        <b>الاقتراح:</b> ضغط إلى MP3 بجودة 128kbps.<br>
        <small>أو استخدم زر "نغمة موبايل" لقص أول 30 ثانية.</small>`;
      state.pasteSuggestion = { action: 'compressAudio', blob: found.blob, type: found.type };
    }
    else {
      const text = (found.text || '').trim();
      if (/^https?:\/\//.test(text)){
        body.innerHTML = `🔗 <b>رابط في الحافظة</b><br>
          <small>${text.slice(0, 100)}</small><br>
          <b>الاقتراح:</b> لصق الملف مباشرة غير مدعوم من الروابط لأسباب أمنية.`;
      } else {
        body.innerHTML = `📝 <b>نص في الحافظة</b> (${text.length} حرف)<br>
          <b>الاقتراح:</b> لا يوجد ملف للمعالجة. انسخ صورة أو ملف صوتي أولاً.`;
      }
    }
  } catch(err){
    body.innerHTML = `⚠️ ${err.message}<br>
      <small>تأكد من منح الإذن للمتصفح بالوصول إلى الحافظة.</small>`;
  }
};

$('#pasteClose').onclick = () => $('#pasteModal').classList.add('hidden');

$('#pasteApply').onclick = async () => {
  const s = state.pasteSuggestion;
  $('#pasteModal').classList.add('hidden');
  if (!s) return toast('لا يوجد اقتراح للتطبيق', true);

  try {
    if (s.action === 'compressImage'){
      const name = 'clipboard-' + Date.now() + '.jpg';
      const out = await compressImage(new File([s.blob], name, { type: s.type }),
                                      state.settings.imageQuality, 'image/jpeg');
      download(out, name);
      toast('تم ضغط الصورة وتنزيلها ✓');
    }
    else if (s.action === 'compressAudio'){
      const ab = await s.blob.arrayBuffer();
      const out = await encodeMP3(ab, 0, 300, 128);
      download(out, 'clipboard-audio.mp3');
      toast('تم ضغط الصوت وتنزيله ✓');
    }
  } catch(e){
    toast('فشل التطبيق: ' + e.message, true);
  }
};

/* ============================================================
   تهيئة
   ============================================================ */
window.addEventListener('load', () => {
  $('#imgQualityVal').textContent = Math.round(state.settings.imageQuality * 100) + '%';
  ['#imgLimitLabel','#audLimitLabel','#fileLimitLabel'].forEach(s =>
    $(s).textContent = state.settings.maxSizeMB);
  if (typeof lamejs === 'undefined')
    console.warn('lamejs لم يُحمَّل — معالجة الصوت معطّلة');
  if (typeof JSZip === 'undefined')
    console.warn('JSZip لم يُحمَّل — تجميع ZIP معطّل');
});$('#audioResetBtn').onclick = () => {
  $('#trimStart').value = 0;
  $('#trimEnd').value = 100;
  updateTrim();
  toast('تمت إعادة الضبط');
};
$('#audioSaveBtn').onclick = () => $('#audioProcess').click();
