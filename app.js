document.addEventListener('DOMContentLoaded', () => {

    // --- 8 & 9. توليد مصفوفة النتائج (3 صفوف عمودية) ---
    const matrixContainer = document.getElementById('matrixContainer');
    const toolsConfig = [
        { icon: 'fa-copy', title: 'نسخ' },
        { icon: 'fa-share-alt', title: 'مشاركة' },
        { icon: 'fa-volume-up', title: 'استماع (TTS)' },
        { icon: 'fa-sync-alt', title: 'إعادة توليد' },
        { icon: 'fa-star', title: 'مفضلة' },
        { icon: 'fa-balance-scale', title: 'مقارنة' },
        { icon: 'fa-edit', title: 'تعديل الأصل' }
    ];

    // بيانات تجريبية للبديلات
    const alternatives = [
        "بديل 1 (دقيق): هذه ترجمة حرفية تحافظ على بنية الجملة الأصلية بدقة عالية.",
        "بديل 2 (طبيعي): هذه صياغة أكثر سلاسة وطبيعية تناسب المحادثات اليومية.",
        "بديل 3 (إبداعي AI): نسخة محسنة بالذكاء الاصطناعي تركز على السياق والمعنى العميق."
    ];

    alternatives.forEach((text, index) => {
        const card = document.createElement('div');
        card.className = 'matrix-card';
        
        let toolsHtml = toolsConfig.map(tool => 
            `<button class="tool-icon neon-circle" title="${tool.title}" data-action="${tool.title}">
                <i class="fas ${tool.icon}"></i>
            </button>`
        ).join('');

        card.innerHTML = `
            <div class="card-content">${text}</div>
            <div class="card-tools">
                ${toolsHtml}
            </div>
        `;
        matrixContainer.appendChild(card);
    });

    // معالجة أحداث أدوات المصفوفة
    matrixContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.tool-icon');
        if (!btn) return;

        const action = btn.dataset.action;
        const cardText = btn.closest('.matrix-card').querySelector('.card-content').innerText;

        if (action === 'نسخ') {
            navigator.clipboard.writeText(cardText).then(() => {
                showFeedback(btn, 'تم النسخ!');
            });
        } else if (action === 'استماع (TTS)') {
            const utterance = new SpeechSynthesisUtterance(cardText);
            // تحديد اللغة بناءً على الاختيار (مثال افتراضي)
            utterance.lang = document.getElementById('targetLangSelect').value; 
            window.speechSynthesis.speak(utterance);
        } else if (action === 'مفضلة') {
            btn.style.color = '#FFD700'; // لون الذهب للمفضلة
            btn.style.borderColor = '#FFD700';
            btn.style.boxShadow = '0 0 10px #FFD700';
        } else {
            console.log(`تنفيذ: ${action}`);
        }
    });

    function showFeedback(element, msg) {
        const originalTitle = element.getAttribute('title');
        element.setAttribute('title', msg);
        setTimeout(() => element.setAttribute('title', originalTitle), 1500);
    }

    // --- 3. تبديل اللغات والاتجاه ---
    const swapBtn = document.getElementById('swapBtn');
    const sourceLang = document.getElementById('sourceLangSelect');
    const targetLang = document.getElementById('targetLangSelect');
    const body = document.body;

    swapBtn.addEventListener('click', () => {
        swapBtn.classList.add('rotating');
        setTimeout(() => swapBtn.classList.remove('rotating'), 400);

        const temp = sourceLang.value;
        sourceLang.value = targetLang.value;
        targetLang.value = temp;

        // تغيير اتجاه الصفحة بناءً على اللغة الهدف
        if (targetLang.value === 'ar') {
            body.setAttribute('dir', 'rtl');
            body.lang = 'ar';
        } else {
            body.setAttribute('dir', 'ltr');
            body.lang = targetLang.value;
        }
    });

    // --- 4. أنماط الترجمة ---
    const modeBtns = document.querySelectorAll('.mode-btn');
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            console.log(`النمط المختار: ${btn.dataset.style}`);
        });
    });

    // --- 6. زر الصق الذكي (Smart Paste) ---
    const smartPasteBtn = document.getElementById('smartPasteBtn');
    const sourceText = document.getElementById('sourceText');

    smartPasteBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            // محاكاة معالجة الذكاء الاصطناعي (تنظيف وتنسيق)
            const cleanedText = text.trim().replace(/\s+/g, ' ');
            sourceText.value = cleanedText;
            
            // تأثير بصري عند النجاح
            smartPasteBtn.style.transform = 'scale(1.2)';
            setTimeout(() => smartPasteBtn.style.transform = 'scale(1)', 200);
        } catch (err) {
            alert('يرجى السماح بالوصول إلى الحافظة أو استخدم Ctrl+V');
        }
    });

    // --- 6. استيراد الملفات (Drag & Drop) ---
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.background = 'rgba(0, 255, 196, 0.1)';
        dropZone.style.borderColor = 'var(--neon-color)';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.background = '';
        dropZone.style.borderColor = '';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.background = '';
        dropZone.style.borderColor = '';
        handleFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', (e) => {
        handleFile(e.target.files[0]);
    });

    function handleFile(file) {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            alert('حجم الملف كبير جداً (الحد الأقصى 10MB)');
            return;
        }
        
        if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
            const reader = new FileReader();
            reader.onload = (e) => sourceText.value = e.target.result;
            reader.readAsText(file);
        } else {
            // محاكاة رفع ملفات PDF/DOCX
            alert(`تم اختيار ملف: ${file.name}\nسيتم معالجته عبر الخادم (محاكاة).`);
        }
    }

    // --- 2. الفقاعة العائمة (السحب) ---
    const bubble = document.getElementById('transBubble');
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    bubble.addEventListener('mousedown', (e) => {
        isDragging = true;
        bubble.style.cursor = 'grabbing';
        const rect = bubble.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = rect.left;
        initialTop = rect.top;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        // استخدام requestAnimationFrame لأداء أفضل
        requestAnimationFrame(() => {
            bubble.style.left = `${initialLeft + dx}px`;
            bubble.style.top = `${initialTop + dy}px`;
            bubble.style.bottom = 'auto'; // إلغاء التثبيت السفلي أثناء السحب
        });
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        bubble.style.cursor = 'grab';
    });

    document.querySelector('.bubble-close').addEventListener('click', () => {
        bubble.style.opacity = '0';
        setTimeout(() => bubble.style.display = 'none', 300);
    });

    // --- 11. اختصارات لوحة المفاتيح ---
    document.addEventListener('keydown', (e) => {
        // Ctrl + Enter لتنفيذ الترجمة (محاكاة)
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            performTranslation();
        }
        // Esc لإغلاق الفقاعة
        if (e.key === 'Escape' && bubble.style.display !== 'none') {
            bubble.style.display = 'none';
        }
    });

    function performTranslation() {
        const input = sourceText.value;
        const resultBox = document.getElementById('mainResult');
        
        if (!input.trim()) {
            resultBox.innerText = "الرجاء إدخال نص للترجمة.";
            return;
        }

        resultBox.innerText = "جاري المعالجة بالذكاء الاصطناعي...";
        
        // محاكاة تأخير الشبكة
        setTimeout(() => {
            resultBox.innerText = `[ترجمة نهائية]: ${input} \n\n(تمت المعالجة بنجاح باستخدام النمط المحدد).`;
        }, 1000);
    }

});