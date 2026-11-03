document.addEventListener('DOMContentLoaded', () => {

    // --- 8 & 9. توليد مصفوفة النتائج (6 خانات) مع الأدوات ---
    const matrixGrid = document.querySelector('.matrix-grid');
    const tools = [
        { icon: '📋', title: 'نسخ' },
        { icon: '🔗', title: 'مشاركة' },
        { icon: '🔊', title: 'استماع (TTS)' },
        { icon: '🔄', title: 'إعادة توليد' },
        { icon: '⭐', title: 'مفضلة' },
        { icon: '⚖️', title: 'مقارنة' },
        { icon: '✏️', title: 'تعديل الأصل' }
    ];

    for (let i = 1; i <= 6; i++) {
        const cell = document.createElement('div');
        cell.className = 'matrix-cell';
        
        let toolsHtml = tools.map(t => 
            `<button class="tool-btn neon-circle" title="${t.title}" data-action="${t.title}">${t.icon}</button>`
        ).join('');

        cell.innerHTML = `
            <div class="cell-text">بديل ترجمي ${i}: هذا نص تجريبي يوضح شكل النتيجة في الخانة.</div>
            <div class="cell-tools">${toolsHtml}</div>
        `;
        matrixGrid.appendChild(cell);
    }

    // --- 3. تبديل اللغات مع الحركة ---
    const swapBtn = document.getElementById('swapBtn');
    const sourceLang = document.getElementById('sourceLang');
    const targetLang = document.getElementById('targetLang');

    swapBtn.addEventListener('click', () => {
        swapBtn.classList.add('rotating');
        setTimeout(() => swapBtn.classList.remove('rotating'), 300);
        
        const tempVal = sourceLang.value;
        sourceLang.value = targetLang.value;
        targetLang.value = tempVal;

        // تبديل اتجاه النص (RTL/LTR)
        document.body.dir = (targetLang.value === 'ar') ? 'rtl' : 'ltr';
    });

    // --- 4. أنماط الترجمة (تحديد الزر النشط) ---
    const modePills = document.querySelectorAll('.mode-pill');
    modePills.forEach(pill => {
        pill.addEventListener('click', () => {
            modePills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            console.log(`تم اختيار النمط: ${pill.dataset.mode}`);
            // هنا يتم استدعاء API لتغيير نمط الترجمة
        });
    });

    // --- 9. وظائف أدوات المصفوفة ---
    matrixGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.tool-btn');
        if (!btn) return;

        const action = btn.dataset.action;
        const cellText = btn.closest('.matrix-cell').querySelector('.cell-text').innerText;

        switch(action) {
            case 'نسخ':
                navigator.clipboard.writeText(cellText);
                showTooltip(btn, 'تم النسخ!');
                break;
            case 'استماع (TTS)':
                const utterance = new SpeechSynthesisUtterance(cellText);
                utterance.lang = targetLang.value;
                window.speechSynthesis.speak(utterance);
                break;
            case 'مفضلة':
                btn.style.color = '#FFD700';
                btn.style.borderColor = '#FFD700';
                btn.style.boxShadow = '0 0 10px #FFD700';
                break;
            default:
                console.log(`تنفيذ الإجراء: ${action}`);
        }
    });

    // مساعدة لعرض إشعار سريع
    function showTooltip(element, message) {
        const originalTitle = element.title;
        element.title = message;
        setTimeout(() => element.title = originalTitle, 1500);
    }

    // --- 2. الفقاعة العائمة (السحب والإفلات) ---
    const bubble = document.getElementById('transBubble');
    let isDragging = false;
    let offsetX, offsetY;

    bubble.addEventListener('mousedown', (e) => {
        isDragging = true;
        bubble.style.cursor = 'grabbing';
        const rect = bubble.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        requestAnimationFrame(() => {
            bubble.style.left = `${e.clientX - offsetX}px`;
            bubble.style.top = `${e.clientY - offsetY}px`;
            bubble.style.bottom = 'auto'; // إلغاء التثبيت السفلي
        });
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        bubble.style.cursor = 'grab';
    });

    // إغلاق الفقاعة
    document.querySelector('.bubble-close').addEventListener('click', () => {
        bubble.style.display = 'none';
    });

    // --- 6. استيراد الملفات (Drag & Drop) ---
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const sourceText = document.getElementById('sourceText');

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--neon-turquoise)';
        dropZone.style.background = 'rgba(0, 255, 196, 0.05)';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '';
        dropZone.style.background = '';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '';
        dropZone.style.background = '';
        const file = e.dataTransfer.files[0];
        handleFile(file);
    });

    fileInput.addEventListener('change', (e) => {
        handleFile(e.target.files[0]);
    });

    function handleFile(file) {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { // 13. قيود الحجم (10MB)
            alert('حجم الملف يتجاوز الحد المسموح (10MB)');
            return;
        }
        if (file.name.endsWith('.txt')) {
            const reader = new FileReader();
            reader.onload = (e) => sourceText.value = e.target.result;
            reader.readAsText(file);
        } else {
            alert('دعم PDF و DOCX يتطلب معالجة عبر الخادم (Backend API).');
        }
    }

    // --- 11. اختصارات لوحة المفاتيح ---
    document.addEventListener('keydown', (e) => {
        // Ctrl + Enter للترجمة
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            triggerTranslation();
        }
        // Escape لإغلاق الفقاعة
        if (e.key === 'Escape') {
            bubble.style.display = 'none';
        }
    });

    function triggerTranslation() {
        const text = sourceText.value;
        const mode = document.querySelector('.mode-pill.active').dataset.mode;
        const isAI = document.getElementById('aiEnhance').matches(':hover'); // مثال
        
        console.log(`جاري الترجمة: "${text}" | النمط: ${mode}`);
        document.getElementById('mainResult').innerText = "جاري المعالجة...";
        
        // محاكاة استدعاء API
        setTimeout(() => {
            document.getElementById('mainResult').innerText = `هذه ترجمة تجريبية للنص: "${text}" باستخدام النمط (${mode}).`;
        }, 1000);
    }

});