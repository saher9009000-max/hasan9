(() => {
  'use strict';

  const LANGS = [
    ['auto', 'اكتشاف تلقائي'], ['ar', 'العربية'], ['en', 'الإنجليزية'], ['fr', 'الفرنسية'], ['es', 'الإسبانية'],
    ['de', 'الألمانية'], ['it', 'الإيطالية'], ['pt', 'البرتغالية'], ['ru', 'الروسية'], ['zh', 'الصينية'],
    ['ja', 'اليابانية'], ['ko', 'الكورية'], ['hi', 'الهندية'], ['ur', 'الأردية'], ['fa', 'الفارسية'],
    ['tr', 'التركية'], ['he', 'العبرية'], ['nl', 'الهولندية'], ['pl', 'البولندية'], ['uk', 'الأوكرانية'],
    ['sv', 'السويدية'], ['no', 'النرويجية'], ['da', 'الدنماركية'], ['fi', 'الفنلندية'], ['el', 'اليونانية'],
    ['cs', 'التشيكية'], ['sk', 'السلوفاكية'], ['hu', 'المجرية'], ['ro', 'الرومانية'], ['bg', 'البلغارية'],
    ['sr', 'الصربية'], ['hr', 'الكرواتية'], ['sl', 'السلوفينية'], ['bs', 'البوسنية'], ['mk', 'المقدونية'],
    ['sq', 'الألبانية'], ['et', 'الإستونية'], ['lv', 'اللاتفية'], ['lt', 'الليتوانية'], ['ga', 'الأيرلندية'],
    ['cy', 'الويلزية'], ['is', 'الأيسلندية'], ['mt', 'المالطية'], ['ca', 'الكاتالونية'], ['eu', 'الباسكية'],
    ['gl', 'الغاليسية'], ['af', 'الأفريكانية'], ['sw', 'السواحيلية'], ['am', 'الأمهرية'], ['so', 'الصومالية'],
    ['ha', 'الهوسا'], ['yo', 'اليوروبا'], ['ig', 'الإيبو'], ['zu', 'الزولو'], ['xh', 'الخوسا'],
    ['st', 'السوتو'], ['sn', 'الشونا'], ['rw', 'الكينيارواندية'], ['ny', 'الشيشيوا'], ['mg', 'الملغاشية'],
    ['tl', 'التاغالوغية'], ['id', 'الإندونيسية'], ['ms', 'الماليزية'], ['vi', 'الفيتنامية'], ['th', 'التايلاندية'],
    ['lo', 'اللاوية'], ['km', 'الخميرية'], ['my', 'البورمية'], ['bn', 'البنغالية'], ['ta', 'التاميلية'],
    ['te', 'التيلوغوية'], ['ml', 'المالايالامية'], ['kn', 'الكانادية'], ['gu', 'الغوجاراتية'], ['mr', 'الماراثية'],
    ['pa', 'البنجابية'], ['ne', 'النيبالية'], ['si', 'السنهالية'], ['ka', 'الجورجية'], ['hy', 'الأرمينية'],
    ['az', 'الأذربيجانية'], ['kk', 'الكازاخية'], ['ky', 'القرغيزية'], ['uz', 'الأوزبكية'], ['tk', 'التركمانية'],
    ['tg', 'الطاجيكية'], ['mn', 'المنغولية'], ['ps', 'الباشتو'], ['ku', 'الكردية'], ['sd', 'السندية'],
    ['yi', 'اليديشية'], ['eo', 'الإسبرانتو'], ['la', 'اللاتينية'], ['be', 'البيلاروسية'], ['lb', 'اللوكسمبورغية'],
    ['fo', 'الفاروية'], ['gd', 'الغيلية'], ['br', 'البريتونية'], ['oc', 'الأوكسيتانية'], ['co', 'الكورسيكية'],
    ['fy', 'الفريزية'], ['haw', 'هاواي'], ['mi', 'الماورية'], ['sm', 'الساموية'], ['to', 'التونغية'],
    ['fj', 'الفيدجية'], ['qu', 'كيتشوا'], ['ay', 'الأيمارا'], ['gn', 'الغوارانية'], ['ht', 'الكريولية'],
    ['jv', 'الجاوية'], ['su', 'السوندية'], ['ceb', 'السيبوانية'], ['hmn', 'همونغ']
  ];

  const DEFAULTS = {
    targetLang: 'ar', sourceLang: 'auto', mode: 'normal', model: '', models: [],
    notifyEnabled: true, opacity: 0.92, darkMode: false, position: null
  };

  const LS = { SETTINGS: 'tt_settings', API_KEY: 'tt_apiKeyEnc', DEVICE: 'tt_device' };

  const state = {
    settings: { ...DEFAULTS }, lastSelection: '', busy: false,
    hideTimer: null, slideTimer: null, toastTimer: null
  };

  const $ = id => document.getElementById(id);
  let $bubble, $dots, $indicator, $result, $panel, $toast;

  function getDeviceKey() {
    let k = localStorage.getItem(LS.DEVICE);
    if (!k) {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      k = btoa(String.fromCharCode(...bytes));
      localStorage.setItem(LS.DEVICE, k);
    }
    return k;
  }

  async function getCryptoKey() {
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey('raw', enc.encode(getDeviceKey()), { name: 'PBKDF2' }, false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode('tt-salt-v1'), iterations: 120000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  async function encryptText(plain) {
    const key = await getCryptoKey();
    const iv  = crypto.getRandomValues(new Uint8Array(12));
    const ct  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
    return { iv: btoa(String.fromCharCode(...iv)), ct: btoa(String.fromCharCode(...new Uint8Array(ct))) };
  }

  async function decryptText(blob) {
    const key = await getCryptoKey();
    const iv = Uint8Array.from(atob(blob.iv), c => c.charCodeAt(0));
    const ct = Uint8Array.from(atob(blob.ct), c => c.charCodeAt(0));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new TextDecoder().decode(pt);
  }

  async function getApiKey() {
    try {
      const raw = localStorage.getItem(LS.API_KEY);
      if (!raw) return null;
      return await decryptText(JSON.parse(raw));
    } catch { return null; }
  }

  async function setApiKey(key) {
    if (!key) { localStorage.removeItem(LS.API_KEY); return; }
    const enc = await encryptText(key);
    localStorage.setItem(LS.API_KEY, JSON.stringify(enc));
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(LS.SETTINGS);
      if (raw) state.settings = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {}
  }
  function saveSettings() {
    try { localStorage.setItem(LS.SETTINGS, JSON.stringify(state.settings)); } catch {}
  }

  async function translateFree(text, source, target) {
    const sl  = source === 'auto' ? 'auto' : source;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('free_failed_' + r.status);
    const j = await r.json();
    const translated = (j[0] || []).map(s => (s && s[0]) || '').join('');
    return { translated, detected: j[2] || null };
  }

  async function translateAI(text, source, target, model, key) {
    if (!key)   throw new Error('missing_api_key');
    if (!model) throw new Error('missing_model');
    const srcLabel = source === 'auto' ? 'the source language (detect automatically)' : source;
    const systemPrompt = `Translate from ${srcLabel} to ${target}. Return ONLY translation.`;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: text }], temperature: 0.2 })
    });

    if (r.status === 401) throw new Error('invalid_key');
    if (r.status === 429) throw new Error('rate_limited');
    if (!r.ok) throw new Error('ai_failed_' + r.status);
    const j = await r.json();
    return { translated: (j.choices?.[0]?.message?.content || '').trim(), detected: null };
  }

  async function validateKey(key) {
    if (!key) return { ok: false, error: 'empty_key' };
    try {
      const r = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: 'Bearer ' + key } });
      if (r.status === 401) return { ok: false, error: 'invalid_key' };
      if (!r.ok) return { ok: false, error: 'http_' + r.status };
      const j = await r.json();
      return { ok: true, models: (j.data || []).map(m => m.id).sort() };
    } catch { return { ok: false, error: 'network_error' }; }
  }

  function notify(msg, isError = false) {
    if (!state.settings.notifyEnabled) return;
    $toast.textContent = msg;
    $toast.classList.toggle('err', !!isError);
    $toast.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(hideToast, isError ? 5000 : 4000);
  }
  function hideToast() { $toast.classList.remove('show'); clearTimeout(state.toastTimer); }

  function showResult(text, meta) {
    $result.innerHTML = '';
    const main = document.createElement('div');
    main.textContent = text;
    $result.appendChild(main);
    if (meta) {
      const m = document.createElement('div');
      m.className = 'meta';
      m.textContent = meta;
      $result.appendChild(m);
    }
    const r = $bubble.getBoundingClientRect();
    let left = r.left - 380 - 12;
    if (left < 8) left = Math.min(window.innerWidth - 380 - 8, r.right + 12);
    $result.style.left = left + 'px';
    $result.style.top  = Math.max(8, Math.min(window.innerHeight - 180, r.top - 20)) + 'px';
    $result.classList.add('show');
  }
  function hideResult() { $result.classList.remove('show'); }

  async function runTranslation(text) {
    if (state.busy) return;
    text = (text || '').trim();
    if (!text) { notify('لم يتم تحديد نص للترجمة', true); return; }
    if (text.length > 5000) text = text.slice(0, 5000);

    state.busy = true;
    showResult('… جارٍ الترجمة', '');
    notify('جارٍ ترجمة ' + text.length + ' حرف...');

    try {
      let res;
      if (state.settings.mode === 'ai') {
        res = await translateAI(text, state.settings.sourceLang, state.settings.targetLang, state.settings.model, await getApiKey());
      } else {
        res = await translateFree(text, state.settings.sourceLang, state.settings.targetLang);
      }
      const meta = [];
      if (res.detected) meta.push('detected: ' + res.detected);
      meta.push(state.settings.mode === 'ai' ? 'model: ' + state.settings.model : 'mode: normal');
      showResult(res.translated || '—', meta.join(' • '));
      notify('✅ تمت الترجمة');
      scheduleSlideOut(3000);
    } catch (e) {
      const errMap = { missing_api_key: 'مفتاح API مفقود', missing_model: 'لم يتم اختيار نموذج', invalid_key: 'مفتاح غير صالح', rate_limited: 'تجاوز حد الطلبات' };
      showResult('⚠️ ' + (errMap[e.message] || e.message), '');
      notify(errMap[e.message] || 'فشل الاتصال', true);
      scheduleSlideOut(5000);
    } finally { state.busy = false; }
  }

  function scheduleSlideOut(ms) {
    clearTimeout(state.slideTimer);
    state.slideTimer = setTimeout(() => {
      if (state.busy) return;
      $bubble.classList.add('slide-left');
      $indicator.classList.add('show');
      clearTimeout(state.hideTimer);
      state.hideTimer = setTimeout(hideResult, 900);
    }, ms);
  }

  function restoreBubble() {
    $indicator.classList.remove('show');
    $bubble.classList.remove('slide-left');
    const p = state.settings.position || { x: window.innerWidth - 80, y: window.innerHeight - 160 };
    $bubble.style.left = p.x + 'px';
    $bubble.style.top  = p.y + 'px';
  }

  function initBubble() {
    const p = state.settings.position || { x: Math.max(8, window.innerWidth - 80), y: Math.max(8, window.innerHeight - 160) };
    $bubble.style.left = p.x + 'px';
    $bubble.style.top  = p.y + 'px';
    let drag = null;

    $bubble.addEventListener('pointerdown', e => {
      if (e.target.closest('.dots')) return;
      drag = { sx: e.clientX, sy: e.clientY, ox: parseFloat($bubble.style.left) || 0, oy: parseFloat($bubble.style.top) || 0, moved: false };
      try { $bubble.setPointerCapture(e.pointerId); } catch {}
    });

    $bubble.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;
      if (drag.moved) {
        $bubble.style.left = Math.max(4, Math.min(window.innerWidth - 62, drag.ox + dx)) + 'px';
        $bubble.style.top  = Math.max(4, Math.min(window.innerHeight - 62, drag.oy + dy)) + 'px';
      }
    });

    $bubble.addEventListener('pointerup', () => {
      if (!drag) return;
      if (drag.moved) {
        state.settings.position = { x: parseFloat($bubble.style.left), y: parseFloat($bubble.style.top) };
        saveSettings();
      } else { onClickBubble(); }
      drag = null;
    });

    $dots.addEventListener('click', e => { e.stopPropagation(); togglePanel(); });
    $indicator.addEventListener('click', restoreBubble);
    $result.addEventListener('click', hideResult);
  }

  function onClickBubble() {
    let text = window.getSelection?.().toString().trim() || state.lastSelection;
    if (!text) text = $('inputText')?.value.trim();
    if (!text) { notify('حدد نصاً أولاً', true); return; }
    runTranslation(text);
  }

  function initSelectionTracking() {
    const capture = () => {
      const s = window.getSelection()?.toString().trim();
      if (s) state.lastSelection = s;
    };
    document.addEventListener('mouseup', capture, true);
    document.addEventListener('selectionchange', capture, true);
  }

  function togglePanel() {
    if ($panel.classList.contains('open')) { $panel.classList.remove('open'); return; }
    const r = $bubble.getBoundingClientRect();
    const panelW = Math.min(328, window.innerWidth - 24);
    let left = r.left - panelW - 12;
    if (left < 8) left = Math.min(window.innerWidth - panelW - 8, r.right + 12);
    $panel.style.left = left + 'px';
    $panel.style.top  = '15px';
    $panel.classList.add('open');
  }

  function initPanel() {
    $('closePanel').addEventListener('click', () => $panel.classList.remove('open'));

    $('checkPermsBtn')?.addEventListener('click', async () => {
      const status = $('permStatus');
      try {
        if (navigator.clipboard) {
          status.textContent = '✅ الإذونات الأساسية وحافظة النصوص مفعّلة';
          status.className = 'hint ok';
        } else {
          status.textContent = '⚠️ الحافظة غير متوفرة';
          status.className = 'hint err';
        }
      } catch (e) {
        status.textContent = '⚠️ تعذر التحقق من الإذونات';
        status.className = 'hint err';
      }
    });

    const modeSel = $('modeSel');
    modeSel.value = state.settings.mode;
    modeSel.addEventListener('change', () => {
      state.settings.mode = modeSel.value;
      saveSettings();
      updateApiSection();
      notify(modeSel.value === 'ai' ? 'وضع الذكاء الاصطناعي مُفعّل' : 'الوضع العادي مُفعّل');
    });

    $('saveKey').addEventListener('click', async () => {
      const key = $('apiKey').value.trim();
      const status = $('keyStatus');
      if (!key) { status.textContent = 'أدخل مفتاحاً أولاً.'; status.className = 'hint err'; return; }
      status.textContent = 'جارٍ التحقق...'; status.className = 'hint'; $('saveKey').disabled = true;
      try {
        const res = await validateKey(key);
        if (!res.ok) { status.textContent = 'مفتاح غير صالح (' + res.error + ')'; status.className = 'hint err'; return; }
        await setApiKey(key);
        status.textContent = '✅ تم التحقق والحفظ المشفّر'; status.className = 'hint ok';
        if (res.models?.length) {
          const set = new Set([...state.settings.models, ...res.models]);
          state.settings.models = Array.from(set).sort();
          if (!state.settings.model) state.settings.model = state.settings.models[0];
          saveSettings(); renderModels();
        }
      } catch (e) { status.textContent = 'خطأ: ' + e.message; status.className = 'hint err'; }
      finally { $('saveKey').disabled = false; }
    });

    $('addModel').addEventListener('click', () => {
      const name = $('newModel').value.trim();
      if (!name) return;
      if (!state.settings.models.includes(name)) state.settings.models.push(name);
      state.settings.model = name;
      $('newModel').value = '';
      saveSettings(); renderModels();
      notify('تمت إضافة النموذج: ' + name);
    });

    $('modelSel').addEventListener('change', e => { state.settings.model = e.target.value; saveSettings(); });
    updateApiSection(); renderModels();
  }

  function updateApiSection() {
    $('apiSection').style.display = state.settings.mode === 'ai' ? 'block' : 'none';
    if (state.settings.mode === 'ai' && !state.settings.model && state.settings.models.length) {
      state.settings.model = state.settings.models[0];
      saveSettings(); renderModels();
    }
  }

  function renderModels() {
    const sel = $('modelSel');
    sel.innerHTML = state.settings.models.length ? '' : '<option value="">— لم تُضف نماذج —</option>';
    state.settings.models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m; opt.textContent = m; if (m === state.settings.model) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function initAppearance() {
    const op = $('opacity'), dk = $('dark'), nt = $('notify');
    op.value = state.settings.opacity; dk.checked = state.settings.darkMode; nt.checked = state.settings.notifyEnabled;
    applyDarkMode(state.settings.darkMode);
    $bubble.style.setProperty('--bo', state.settings.opacity);

    op.addEventListener('input', () => { state.settings.opacity = parseFloat(op.value); $bubble.style.setProperty('--bo', state.settings.opacity); saveSettings(); });
    dk.addEventListener('change', () => { state.settings.darkMode = dk.checked; applyDarkMode(dk.checked); saveSettings(); });
    nt.addEventListener('change', () => { state.settings.notifyEnabled = nt.checked; saveSettings(); if (!nt.checked) hideToast(); });
  }

  function applyDarkMode(on) { document.body.classList.toggle('dark', on); }

  function initLanguages() {
    const src = $('srcSel'), tgt = $('tgtSel');
    LANGS.forEach(([code, name]) => {
      src.insertAdjacentHTML('beforeend', `<option value="${code}">${name} (${code})</option>`);
      if (code !== 'auto') tgt.insertAdjacentHTML('beforeend', `<option value="${code}">${name} (${code})</option>`);
    });
    src.value = state.settings.sourceLang; tgt.value = state.settings.targetLang;
    src.addEventListener('change', () => { state.settings.sourceLang = src.value; saveSettings(); });
    tgt.addEventListener('change', () => { state.settings.targetLang = tgt.value; saveSettings(); });
  }

  function boot() {
    $bubble = $('bubble'); $dots = $('dots'); $indicator = $('indicator');
    $result = $('result'); $panel = $('panel'); $toast = $('toast');

    loadSettings();
    initLanguages(); initAppearance(); initBubble(); initPanel(); initSelectionTracking();
    $('translateBtn')?.addEventListener('click', () => {
      const text = $('inputText').value.trim();
      if (text) runTranslation(text); else notify('النص فارغ', true);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
