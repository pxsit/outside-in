(function () {
    const TOPICS = ['circulatory', 'respiratory', 'lymphatic', 'nervous'];

    // Translate with an inline fallback, so the page still reads correctly if locales.json failed
    function tr(key, fallback, vars) {
        const text = window.t ? window.t(key, vars) : key;
        return text === key ? fallback : text;
    }

    function getTopicFromUrl() {
        return window.location.pathname.split('/').pop().replace('.html', '');
    }

    // Guards against an older fetch finishing after a newer language switch
    let renderToken = 0;

    function renderTopic() {
        const topicKey = getTopicFromUrl();
        const container = document.querySelector('.system-content');
        if (!container || !TOPICS.includes(topicKey)) return;

        const token = ++renderToken;
        window
            .loadLesson(topicKey)
            .then((topic) => {
                if (token === renderToken) renderLesson(container, topicKey, topic);
            })
            .catch((err) => {
                console.error(`Failed to load lesson '${topicKey}':`, err);
                if (token === renderToken) renderError(container);
            });
    }

    function renderError(container) {
        container.innerHTML = `
            <p class="section-description" role="alert">
                ${tr('lesson_load_error', 'ไม่สามารถโหลดบทเรียนได้ กรุณาลองใหม่อีกครั้ง')}
            </p>
            <div class="lesson-page-actions">
                <button type="button" class="btn primary" data-action="retry">
                    ${tr('quiz_retry', 'ลองอีกครั้ง')}
                </button>
            </div>`;
        container.querySelector('[data-action="retry"]').addEventListener('click', renderTopic);
    }

    function renderLesson(container, topicKey, topic) {
        const isEn = window.currentLang === 'en';
        const desc = tr(`lesson_desc_${topicKey}`, '');
        const startQuiz = tr('lesson_start_quiz', 'เริ่มแบบทดสอบสำหรับ ');
        const menuText = tr('lesson_menu', 'Menu');

        document.title = `${topic.name} - Outside In`;

        const sections = buildSections(topic, topicKey, isEn);
        const toc = topic.pages
            .map(
                (p, idx) =>
                    `<li><a href="#sec-${idx + 1}">${idx + 1}. ${stripTags(p.title)}</a></li>`
            )
            .join('');

        container.innerHTML = `
            <h1 class="section-title">${topic.name}</h1>
            ${desc ? `<p class="section-description">${desc}</p>` : ''}
            <nav class="lesson-toc panel" aria-label="${isEn ? 'Contents' : 'สารบัญ'}">
                <ol>${toc}</ol>
            </nav>
            ${sections}
            <div class="lesson-page-actions">
                <button type="button" class="cta-button" data-action="start-quiz">
                    <i class="icon icon-award" aria-hidden="true"></i>
                    ${startQuiz}${topic.name}
                </button>
                <a class="btn ghost" href="../index.html#menu">
                    <i class="icon icon-bars" aria-hidden="true"></i> ${menuText}
                </a>
            </div>
        `;

        container.querySelector('[data-action="start-quiz"]').addEventListener('click', () => {
            if (window.startTopicQuiz) window.startTopicQuiz(topicKey);
        });

        setupBrainImageFallback(isEn);
    }

    function stripTags(html) {
        const el = document.createElement('div');
        el.innerHTML = html;
        return el.textContent;
    }

    function panel(p, idx) {
        return `
            <section class="panel lesson-panel" id="sec-${idx + 1}">
                <h2 class="h3">${idx + 1}. ${p.title}</h2>
                ${p.html}
            </section>`;
    }

    function buildSections(topic, topicKey, isEn) {
        const cnsIndex =
            topicKey === 'nervous'
                ? topic.pages.findIndex((p) =>
                      /ระบบประสาทส่วนกลาง|Central Nervous System/.test(p.title)
                  )
                : -1;

        return topic.pages
            .map((p, idx) => {
                if (idx !== cnsIndex) return panel(p, idx);

                const brainTitle = isEn ? 'Brain Diagram' : 'ภาพสมอง';
                const brainAlt = isEn ? 'Diagram of the human brain' : 'แผนภาพสมองมนุษย์';
                return `
                    <section class="panel lesson-panel">
                        <h2 class="h3">${brainTitle}</h2>
                        <div class="brain-diagram-container">
                            <img src="../assets/brain.webp" alt="${brainAlt}"
                                class="brain-diagram-img" loading="lazy" decoding="async">
                        </div>
                    </section>${panel(p, idx)}`;
            })
            .join('');
    }

    function setupBrainImageFallback(isEn) {
        const brainImg = document.querySelector('.brain-diagram-img');
        if (!brainImg) return;
        brainImg.addEventListener('error', function () {
            const container = this.closest('.brain-diagram-container');
            if (!container) return;
            this.style.display = 'none';
            const fallback = document.createElement('div');
            fallback.className = 'muted';
            fallback.textContent = isEn ? 'Brain diagram unavailable' : 'ไม่สามารถแสดงภาพสมองได้';
            container.appendChild(fallback);
        });
    }

    window.backToMenu = function () {
        window.location.href = '../index.html#menu';
    };

    // main.js dispatches languageChanged once locales have loaded (or failed), including on
    // first load, so this is also the initial render.
    window.addEventListener('languageChanged', renderTopic);
})();
