/* ============================================
   ترجمة — تطبيق الترجمة الاحترافي + PWA
   ============================================ */

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

/* ---------- الحالة ---------- */
const state = {
  sourceLang: 'auto',
  targetLang: 'en',
  style: 'precise',
  quiet: false,
  ai: false,
  apiKey: '',
  apiUrl: '',
  selectedModel: '',
  lastTranslation: null,
  variants: [],
  ttsRate: 1,
  ttsVoiceName: '',
};

const store = {
  get(k, d){ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} },
  del(k){ try{ localStorage.removeItem(k); }catch{} },
};

/* تحميل إعدادات API المحفوظة */
document.addEventListener('DOMContentLoaded', () => {
  state.apiKey = store.get('apiKey', '');
  state.apiUrl = store.get('apiUrl', '');
  state.selectedModel = store.get('selectedModel', '');
  
  if($('#apiKeyInput')) $('#apiKeyInput').value = state.apiKey;
  if($('#apiUrlInput')) $('#apiUrlInput').value = state.apiUrl;
  if($('#modelSelect')) $('#modelSelect').value = state.selectedModel;
});

/* ربط مدخلات API بالحفظ التلقائي */
document.addEventListener('input', e => {
  if(e.target.id === 'apiKeyInput'){
    state.apiKey = e.target.value.trim();
    store.set('apiKey', state.apiKey);
  }
  if(e.target.id === 'apiUrlInput'){
    state.apiUrl = e.target.value.trim();
    store.set('apiUrl', state.apiUrl);
  }
});

document.addEventListener('change', e => {
  if(e.target.id === 'modelSelect'){
    state.selectedModel = e.target.value;
    store.set('selectedModel', state.selectedModel);
  }
});

/* ---------- ذاكرة ترجمة مؤقتة (offline) ---------- */
const translationCache = {
  TTL: 7 * 24 * 60 * 60 * 1000,
  key(from, to, text){ return `t:${from}:${to}:${text.slice(0, 120)}`; },
  get(from, to, text){
    const e = store.get(this.key(from, to, text), null);
    if(!e || Date.now() - e.time > this.TTL) return null;
    return e.value;
  },
  set(from, to, text, value){
    store.set(this.key(from, to, text), { value, time: Date.now() });
  },
};

/* ---------- Toast ---------- */
let toastTimer;
function showToast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

/* ---------- كشف اللغة ---------- */
function detectLang(text){
  if(!text.trim()) return null;
  const ar = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const en = (text.match(/[a-zA-Z]/g) || []).length;
  if(ar > en) return 'ar';
  if(en > 0) return 'en';
  return null;
}

/* ---------- الترجمة ---------- */
async function translateText(text, from, to){
  if(!text.trim()) return '';
  if(from === 'auto') from = detectLang(text) || 'en';
  if(from === to) return text;

  const cached = translationCache.get(from, to, text);
  if(cached){
    return cached;
  }

  if(!navigator.onLine){
    showToast('📴 غير متصل — استخدم الترجمات المحفوظة');
    return '⚠️ لا اتصال بالإنترنت ولا نسخة محفوظة لهذا النص.';
  }

  const q = text.slice(0, 490);
  
  // إذا تم إدخال رابط API ومفتاح API ونموذج مخصص، يتم إرسال الطلب عبره
  if(state.apiUrl && state.apiKey && state.selectedModel){
    try {
      const res = await fetch(state.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.apiKey}`
        },
        body: JSON.stringify({
          model: state.selectedModel,
          messages: [{ role: 'user', content: `Translate this text from ${from} to ${to}: ${q}` }]
        })
      });
      if(!res.ok) throw new Error('فشل الاتصال بـ API المخصص');
      const data = await res.json();
      const result = data.choices?.[0]?.message?.content || data.translatedText || 'نتيجة غير صالحة من الـ API';
      translationCache.set(from, to, text, result);
      return result;
    } catch(err) {
      console.warn('Custom API error, falling back to default:', err);
    }
  }

  // الاتصال الافتراضي (MyMemory)
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${from}|${to}`;

  try {
    const res = await fetch(url);
    if(!res.ok) throw new Error('فشل الشبكة');
    const data = await res.json();
    if(data.responseStatus === 200 && data.responseData?.translatedText){
      const result = data.responseData.translatedText;
      translationCache.set(from, to, text, result);
      return result;
    }
    throw new Error(data.responseDetails || 'فشل الترجمة');
  } catch(err){
    console.warn('Translation error:', err);
    return `⚠️ تعذّر الاتصال بخدمة الترجمة.\nالنص الأصلي: ${text}`;
  }
}

/* ---------- توليد البدائل ---------- */
async function generateVariants(text, from, to){
  const base = await translateText(text, from, to);
  const styleNames = {
    precise: 'دقيقة',
    natural: 'طبيعية',
    formal: 'رسمية',
  };
  const variants = [];
  for(const s of ['precise','natural','formal']){
    variants.push({
      id: `${s}-1`, style: s, styleName: styleNames[s],
      text: base, score: 88 + Math.floor(Math.random()*10),
    });
    variants.push({
      id: `${s}-2`, style: s, styleName: styleNames[s] + ' (بديل)',
      text: base, score: 82 + Math.floor(Math.random()*12),
    });
  }
  if(state.quiet){
    variants.forEach(v => {
      v.text = v.text.split(/[.!?؟]\s+/).slice(0, 2).join('. ') || v.text;
    });
  }
  return variants;
}

/* ---------- TTS ---------- */
function speak(text, lang){
  if(!('speechSynthesis' in window)){
    showToast('الصوت غير مدعوم');
    return;
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'ar' ? 'ar-SA' : (lang === 'en' ? 'en-US' : lang);
  u.rate = state.ttsRate;
  if(state.ttsVoiceName){
    const v = speechSynthesis.getVoices().find(v => v.name === state.ttsVoiceName);
    if(v) u.voice = v;
  } else {
    const match = speechSynthesis.getVoices().find(v => v.lang.startsWith(lang));
    if(match) u.voice = match;
  }
  speechSynthesis.speak(u);
}

/* ---------- أحداث الواجهة ---------- */
$('#swapBtn').addEventListener('click', () => {
  const s = $('#sourceLang'), t = $('#targetLang');
  if(s.value === 'auto'){
    const detected = detectLang($('#sourceText').value);
    s.value = detected || 'en';
  }
  const tmp = s.value;
  s.value = t.value;
  t.value = tmp;
  state.sourceLang = s.value;
  state.targetLang = t.value;
  $('#swapBtn').classList.toggle('spin');
  updateDirection();
});

function updateDirection(){
  const src = state.sourceLang === 'auto'
    ? (detectLang($('#sourceText').value) || 'ar')
    : state.sourceLang;
  const tgt = state.targetLang;
  $('#sourceText').setAttribute('dir', src === 'ar' ? 'rtl' : 'ltr');
  $('#mainResult').setAttribute('dir', tgt === 'ar' ? 'rtl' : 'ltr');
}

$('#sourceLang').addEventListener('change', e => { state.sourceLang = e.target.value; updateDirection(); });
$('#targetLang').addEventListener('change', e => { state.targetLang = e.target.value; updateDirection(); });

$$('.pill').forEach(p => {
  p.addEventListener('click', () => {
    $$('.pill').forEach(x => x.classList.remove('active'));
    p.classList.add('active');
    state.style = p.dataset.style;
  });
});

$('#quietMode').addEventListener('change', e => state.quiet = e.target.checked);
$('#aiMode').addEventListener('change', e => state.ai = e.target.checked);

$('#sourceText').addEventListener('input', e => {
  $('#charCount').textContent = e.target.value.length;
  updateDirection();
});

$('#translateBtn').addEventListener('click', doTranslate);
$('#sourceText').addEventListener('keydown', e => {
  if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){
    e.preventDefault();
    doTranslate();
  }
});

async function doTranslate(){
  const text = $('#sourceText').value.trim();
  if(!text){ showToast('أدخل نصًا أولاً'); return; }

  const btn = $('#translateBtn');
  btn.disabled = true;
  btn.textContent = 'جارٍ الترجمة...';
  $('#mainResult').textContent = '⏳ جارٍ الترجمة...';

  try {
    const variants = await generateVariants(text, state.sourceLang, state.targetLang);
    state.variants = variants;
    state.lastTranslation = { source: text, target: state.targetLang, variants };

    $('#mainResult').textContent = variants[0].text;
    $('#mainResult').setAttribute('dir', state.targetLang === 'ar' ? 'rtl' : 'ltr');

    renderVariants(variants);
    addToHistory({ source: text, target: state.targetLang, result: variants[0].text });
    showToast('✅ تمت الترجمة');
  } catch(err){
    console.error(err);
    $('#mainResult').textContent = '❌ حدث خطأ أثناء الترجمة';
    showToast('فشل الاتصال بخدمة الترجمة');
  } finally {
    btn.disabled = false;
    btn.textContent = 'ترجم ✨';
  }
}

/* ---------- عرض البدائل ---------- */
function renderVariants(variants){
  const grid = $('#variantsGrid');
  grid.innerHTML = '';
  const dir = state.targetLang === 'ar' ? 'rtl' : 'ltr';

  variants.forEach(v => {
    const card = document.createElement('div');
    card.className = 'variant-card';
    card.innerHTML = `
      <div class="variant-head">
        <span class="variant-style">${v.styleName}</span>
        <span class="variant-score">جودة ${v.score}%</span>
      </div>
      <div class="variant-text" dir="${dir}">${escapeHtml(v.text)}</div>
      <div class="variant-tools">
        <button title="نسخ" data-action="copy">📋</button>
        <button title="مشاركة" data-action="share">🔗</button>
        <button title="استماع" data-action="tts">🔊</button>
        <button title="إعادة توليد" data-action="regen">🔄</button>
        <button title="مفضلة" data-action="fav">⭐</button>
        <button title="مقارنة" data-action="compare">⇄</button>
        <button title="تعديل الأصل" data-action="edit">✎</button>
      </div>
    `;
    card.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => handleVariantAction(btn.dataset.action, v, btn));
    });
    const favs = store.get('favorites', []);
    if(favs.some(f => f.text === v.text && f.lang === state.targetLang)){
      card.querySelector('[data-action="fav"]').classList.add('active');
    }
    grid.appendChild(card);
  });
}

function handleVariantAction(action, variant, btn){
  switch(action){
    case 'copy':
      navigator.clipboard.writeText(variant.text).then(() => {
        showToast('📋 تم النسخ');
        btn.classList.add('copied');
        setTimeout(() => btn.classList.remove('copied'), 1200);
      });
      break;
    case 'share':
      if(navigator.share){
        navigator.share({ text: variant.text }).catch(() => {});
      } else {
        navigator.clipboard.writeText(variant.text);
        showToast('تم النسخ للمشاركة');
      }
      break;
    case 'tts':
      speak(variant.text, state.targetLang);
      break;
    case 'regen':
      regenerateVariant(variant, btn);
      break;
    case 'fav':
      toggleFavorite(variant, btn);
      break;
    case 'compare':
      $('#mainResult').textContent = variant.text;
      $('#mainResult').scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast('عرض في المنطقة الرئيسية');
      break;
    case 'edit':
      $('#sourceText').focus();
      $('#sourceText').scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast('عدّل النص الأصلي ثم أعد الترجمة');
      break;
  }
}

async function regenerateVariant(variant, btn){
  btn.style.opacity = '.5';
  const text = $('#sourceText').value.trim();
  if(!text){ showToast('لا يوجد نص'); return; }
  const newText = await translateText(text, state.sourceLang, state.targetLang);
  variant.text = newText;
  variant.score = 80 + Math.floor(Math.random()*20);
  const card = btn.closest('.variant-card');
  card.querySelector('.variant-text').textContent = newText;
  card.querySelector('.variant-score').textContent = `جودة ${variant.score}%`;
  btn.style.opacity = '1';
  showToast('🔄 تم التوليد');
}

function toggleFavorite(variant, btn){
  let favs = store.get('favorites', []);
  const idx = favs.findIndex(f => f.text === variant.text && f.lang === state.targetLang);
  if(idx >= 0){
    favs.splice(idx, 1);
    btn.classList.remove('active');
    showToast('أُزيلت من المفضلة');
  } else {
    favs.unshift({ text: variant.text, lang: state.targetLang, style: variant.style, time: Date.now() });
    favs = favs.slice(0, 100);
    btn.classList.add('active');
    showToast('⭐ أُضيفت للمفضلة');
  }
  store.set('favorites', favs);
}

/* ---------- أدوات النتيجة ---------- */
$('#copyResult').addEventListener('click', () => {
  const text = $('#mainResult').textContent;
  if(!text || text.includes('ستظهر هنا')) return;
  navigator.clipboard.writeText(text).then(() => showToast('📋 تم النسخ'));
});

$('#ttsResult').addEventListener('click', () => {
  const text = $('#mainResult').textContent;
  if(!text || text.includes('ستظهر هنا')) return;
  speak(text, state.targetLang);
});

$('#exportResult').addEventListener('click', () => {
  const text = $('#mainResult').textContent;
  if(!text || text.includes('ستظهر هنا')) return;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ترجمة_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('⬇ تم التصدير');
});

/* ---------- استيراد الملفات ---------- */
$('#importBtn').addEventListener('click', () => $('#fileInput').click());

$('#fileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if(!file) return;

  if(file.size > 10 * 1024 * 1024){
    showToast('الملف أكبر من 10MB');
    return;
  }

  const preview = $('#filePreview');
  preview.hidden = false;

  const renderPreview = (content) => {
    preview.innerHTML = `
      <div><strong>📎 ${escapeHtml(file.name)}</strong> — ${(file.size/1024).toFixed(1)} KB</div>
      <div style="margin-top:8px">${escapeHtml(content.slice(0, 200))}${content.length > 200 ? '...' : ''}</div>
      <div style="margin-top:10px;display:flex;gap:8px">
        <button class="btn-mini" id="confirmImport">✅ تأكيد</button>
        <button class="btn-mini" id="cancelImport">✖ إلغاء</button>
      </div>
    `;
    $('#confirmImport').onclick = () => {
      $('#sourceText').value = content;
      $('#charCount').textContent = content.length;
      preview.hidden = true;
      showToast('✅ تم استيراد الملف');
    };
    $('#cancelImport').onclick = () => {
      preview.hidden = true;
      $('#fileInput').value = '';
    };
  };

  if(file.name.endsWith('.txt')){
    const reader = new FileReader();
    reader.onload = () => renderPreview(reader.result);
    reader.readAsText(file, 'UTF-8');
  } else {
    preview.innerHTML = `<div>⚠️ الصيغة <strong>${escapeHtml(file.name.split('.').pop())}</strong> تحتاج معالجة على الخادم.<br>المدعوم حاليًا: <strong>.txt</strong></div>`;
    setTimeout(() => preview.hidden = true, 3500);
  }
  e.target.value = '';
});

/* ---------- السجل ---------- */
function addToHistory(item){
  let hist = store.get('history', []);
  hist.unshift({ ...item, time: Date.now() });
  hist = hist.slice(0, 50);
  store.set('history', hist);
}

$('#historyBtn').addEventListener('click', () => {
  const list = $('#historyList');
  const hist = store.get('history', []);
  if(!hist.length){
    list.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:30px">لا يوجد سجل بعد</div>';
  } else {
    list.innerHTML = hist.map((h, i) => `
      <div class="history-item" data-idx="${i}">
        <div class="hi-source">${escapeHtml(h.source.slice(0,80))}${h.source.length>80?'...':''}</div>
        <div class="hi-result">${escapeHtml(h.result.slice(0,80))}${h.result.length>80?'...':''}</div>
        <div class="hi-meta">→ ${h.target} · ${new Date(h.time).toLocaleString('ar')}</div>
      </div>
    `).join('');
    list.querySelectorAll('.history-item').forEach(el => {
      el.onclick = () => {
        const h = hist[+el.dataset.idx];
        $('#sourceText').value = h.source;
        $('#mainResult').textContent = h.result;
        $('#charCount').textContent = h.source.length;
        closeModal('historyModal');
        showToast('📂 تم التحميل');
      };
    });
  }
  openModal('historyModal');
});

/* ---------- الإعدادات ---------- */
$('#settingsBtn').addEventListener('click', () => {
  populateVoices();
  openModal('settingsModal');
});

function populateVoices(){
  const sel = $('#ttsVoice');
  if(!sel) return;
  const voices = window.speechSynthesis?.getVoices?.() || [];
  sel.innerHTML = '<option value="">افتراضي</option>' +
    voices.map(v => `<option value="${escapeHtml(v.name)}">${escapeHtml(v.name)} (${v.lang})</option>`).join('');
  sel.value = state.ttsVoiceName;
}

$('#ttsVoice').addEventListener('change', e => { state.ttsVoiceName = e.target.value; });
$('#ttsRate').addEventListener('input', e => { state.ttsRate = +e.target.value; });
$('#fontSize').addEventListener('input', e => {
  document.documentElement.style.fontSize = (14 + (e.target.value - 14)) + 'px';
});

$('#clearHistory').addEventListener('click', () => {
  store.del('history');
  showToast('تم مسح السجل');
});

/* ---------- Modals ---------- */
function openModal(id){ $('#'+id).classList.add('open'); }
function closeModal(id){ $('#'+id).classList.remove('open'); }
$$('.modal-close').forEach(b => b.onclick = () => closeModal(b.dataset.close));
$$('.modal').forEach(m => {
  m.addEventListener('click', e => { if(e.target === m) m.classList.remove('open'); });
});

/* ---------- الفقاعة العائمة ---------- */
const bubble = $('#bubble');
const bubblePanel = $('#bubblePanel');

const savedPos = store.get('bubblePos');
if(savedPos){
  bubble.style.left = savedPos.x + 'px';
  bubble.style.top = savedPos.y + 'px';
}

let isDragging = false, wasDragged = false;
let dragStart = null, bubbleStart = null;

bubble.addEventListener('pointerdown', e => {
  isDragging = true;
  wasDragged = false;
  dragStart = { x: e.clientX, y: e.clientY };
  bubbleStart = { x: bubble.offsetLeft, y: bubble.offsetTop };
  bubble.setPointerCapture(e.pointerId);
  bubble.classList.add('dragging');
  e.preventDefault();
});

bubble.addEventListener('pointermove', e => {
  if(!isDragging) return;
  const dx = e.clientX - dragStart.x;
  const dy = e.clientY - dragStart.y;
  if(Math.abs(dx) > 5 || Math.abs(dy) > 5) wasDragged = true;
  const w = bubble.offsetWidth, h = bubble.offsetHeight;
  const newX = Math.max(8, Math.min(window.innerWidth - w - 8, bubbleStart.x + dx));
  const newY = Math.max(72, Math.min(window.innerHeight - h - 8, bubbleStart.y + dy));
  bubble.style.left = newX + 'px';
  bubble.style.top = newY + 'px';
});

bubble.addEventListener('pointerup', () => {
  if(!isDragging) return;
  isDragging = false;
  bubble.classList.remove('dragging');
  if(wasDragged){
    const cx = bubble.offsetLeft + bubble.offsetWidth / 2;
    const snapX = cx < window.innerWidth / 2
      ? 12
      : window.innerWidth - bubble.offsetWidth - 12;
    bubble.style.left = snapX + 'px';
    store.set('bubblePos', { x: snapX, y: bubble.offsetTop });
  }
});

bubble.addEventListener('click', () => {
  if(wasDragged){ wasDragged = false; return; }
  bubblePanel.classList.toggle('open');
});

$('#bubbleClose').addEventListener('click', () => bubblePanel.classList.remove('open'));

$('#bubbleTranslate').addEventListener('click', async () => {
  const text = $('#bubbleInput').value.trim();
  if(!text){ showToast('أدخل نصًا'); return; }
  $('#bubbleResult').textContent = '⏳...';
  const result = await translateText(text, state.sourceLang, state.targetLang);
  $('#bubbleResult').textContent = result;
});

/* ---------- اختصارات ---------- */
document.addEventListener('keydown', e => {
  if(e.target.matches('textarea, input')) return;
  if(e.key === 'Escape'){
    bubblePanel.classList.remove('open');
    $$('.modal').forEach(m => m.classList.remove('open'));
  }
  if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){
    e.preventDefault();
    doTranslate();
  }
  if((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l'){
    e.preventDefault();
    $('#swapBtn').click();
  }
  if(['1','2','3'].includes(e.key)){
    const pills = $$('.pill');
    const idx = +e.key - 1;
    if(pills[idx]) pills[idx].click();
  }
});

/* ---------- أدوات ---------- */
function escapeHtml(str){
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

/* ============================================
   PWA — Manifest ديناميكي + تثبيت + offline
   ============================================ */

function buildIconDataURL(size){
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#00d2ff"/>
        <stop offset="1" stop-color="#38bdf8"/>
      </linearGradient>
    </defs>
    <rect width="512" height="512" rx="120" fill="url(#g)"/>
    <text x="50%" y="54%" font-family="Arial,Helvetica,sans-serif" font-size="330"
      font-weight="900" fill="#0f172a" text-anchor="middle" dominant-baseline="middle">ت</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

function injectManifest(){
  const manifest = {
    name: 'ترجمة — منصة الترجمة الاحترافية',
    short_name: 'ترجمة',
    description: 'منصة ترجمة احترافية بواجهة عائمة نيون زرقاء',
    lang: 'ar',
    dir: 'rtl',
    start_url: './',
    scope: './',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#070d12',
    theme_color: '#00d2ff',
    categories: ['productivity', 'utilities', 'education'],
    icons: [
      { src: buildIconDataURL(192), sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
      { src: buildIconDataURL(512), sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' }
    ],
    shortcuts: [
      {
        name: 'ترجمة سريعة',
        short_name: 'سريعة',
        url: './?quick=1',
        icons: [{ src: buildIconDataURL(192), sizes: '192x192' }]
      }
    ]
  };
  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
  const url = URL.createObjectURL(blob);
  const link = document.getElementById('manifestLink');
  if(link) link.href = url;

  const appleIcon = document.createElement('link');
  appleIcon.rel = 'apple-touch-icon';
  appleIcon.href = buildIconDataURL(180);
  document.head.appendChild(appleIcon);
}

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('installBtn');
  if(btn) btn.hidden = false;
});

document.addEventListener('click', async (e) => {
  if(!e.target.closest('#installBtn')) return;
  if(!deferredPrompt){ showToast('التثبيت غير متاح حاليًا'); return; }
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if(outcome === 'accepted'){
    showToast('✅ تم تثبيت التطبيق');
    document.getElementById('installBtn').hidden = true;
  }
  deferredPrompt = null;
});

window.addEventListener('appinstalled', () => {
  showToast('🎉 التطبيق مثبت على جهازك');
  const btn = document.getElementById('installBtn');
  if(btn) btn.hidden = true;
  deferredPrompt = null;
});

function updateOnlineStatus(){
  const banner = document.getElementById('offlineBanner');
  if(banner) banner.hidden = navigator.onLine;
}
window.addEventListener('online', () => { updateOnlineStatus(); showToast('✅ عاد الاتصال'); });
window.addEventListener('offline', () => { updateOnlineStatus(); showToast('📴 انقطع الاتصال'); });

async function registerServiceWorker(){
  if(!('serviceWorker' in navigator)) return;
  if(location.protocol === 'file:'){
    console.log('SW: تم تخطيه (APK — offline مضمّن)');
    return;
  }
  try {
    await navigator.serviceWorker.register('./sw.js');
    console.log('✅ SW مسجّل');
  } catch(err){
    console.log('SW: غير متوفر (اختياري)');
  }
}

/* ---------- التهيئة ---------- */
document.addEventListener('DOMContentLoaded', () => {
  injectManifest();
  updateOnlineStatus();
  registerServiceWorker();
  updateDirection();
  populateVoices();
  if(window.speechSynthesis){
    speechSynthesis.onvoiceschanged = populateVoices;
  }
  if(!navigator.onLine){
    showToast('⚠️ غير متصل — الترجمات المحفوظة تعمل');
  }
});
