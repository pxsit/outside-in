// Generic quiz handler with shuffling and tags/difficulty support
(function () {
    // Constants
    const MAX_QUESTIONS = 10;
    const SCROLL_DELAY = 120;
    const RENDER_DELAY = 50;

    // State
    let currentQuestions = [];
    let currentIndex = 0;
    let selectedAnswer = null;
    let score = 0;
    let currentTopic = '';
    // Per-question responses in the same order as `currentQuestions`
    // Each entry: { selectedIndex: number|null, ts: number }
    let responses = [];

    // Initialize quiz data
    window.quizData = window.quizData || {};

    // Cache DOM element getter
    const getStage = () => document.getElementById('quiz-stage');

    /**
     * Fisher-Yates shuffle algorithm - O(n) time complexity
     * Shuffles array in place
     */
    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    /**
     * Shuffle choices while tracking the correct answer index
     */
    function shuffleChoicesOnQuestion(q) {
        if (!q || !Array.isArray(q.choices) || q.choices.length === 0) return q;
        if (typeof q.ans !== 'number' || q.ans < 0 || q.ans >= q.choices.length) return q;

        const labeled = q.choices.map((c, idx) => ({ c, idx }));
        shuffleArray(labeled);
        q.choices = labeled.map((x) => x.c);
        q.ans = labeled.findIndex((x) => x.idx === q.ans);
        return q;
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(str) {
        if (typeof str !== 'string') return str;
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Scroll to quiz section smoothly
     */
    function scrollToQuiz() {
        const quizSection = document.getElementById('final-quiz');
        if (quizSection?.scrollIntoView) {
            quizSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function render() {
        const stage = getStage();
        if (!stage) {
            setTimeout(render, 50);
            return;
        }

        const isEn = window.currentLang === 'en'; // Define isEn at the start of render

        // Guard
        if (!Array.isArray(currentQuestions)) currentQuestions = [];

        // Recompute score from responses (only depends on final selections)
        score = 0;
        for (let i = 0; i < currentQuestions.length; i++) {
            const q = currentQuestions[i];
            const r = responses[i];
            if (r && r.selectedIndex !== null && r.selectedIndex !== undefined) {
                if (r.selectedIndex === q.ans) score++;
            }
        }

        // Hydrate selectedAnswer from persisted responses
        const currentResponse = responses[currentIndex];
        selectedAnswer =
            currentResponse &&
            currentResponse.selectedIndex !== null &&
            currentResponse.selectedIndex !== undefined
                ? currentResponse.selectedIndex
                : null;

        if (currentIndex >= currentQuestions.length) {
            // Render detailed summary with all questions, selections, highlights, and explanations
            const summaryItems = currentQuestions
                .map((q, idx) => {
                    const r = responses[idx];
                    const selectedIndex = r ? r.selectedIndex : null;
                    const wasSkipped = selectedIndex === null || selectedIndex === undefined;
                    const isCorrect = !wasSkipped && selectedIndex === q.ans;

                    const choiceHtml = (q.choices || [])
                        .map((c, cIdx) => {
                            let cls = 'quiz-choice';
                            if (cIdx === q.ans) cls += ' correct';
                            if (!wasSkipped && cIdx === selectedIndex) cls += ' selected';
                            if (!wasSkipped && !isCorrect && cIdx === selectedIndex)
                                cls += ' incorrect';
                            return `<div class="${cls}" style="pointer-events:none"><div class="quiz-choice-checkbox"></div><span>${escapeHtml(
                                String(c)
                            )}</span></div>`;
                        })
                        .join('');

                    const fbColor = wasSkipped ? '#a3a3a3' : isCorrect ? '#34d399' : '#f87171';
                    const fbText = wasSkipped
                        ? (isEn ? 'Skipped. Answer: ' : 'คุณข้ามข้อนี้ เฉลยคือ: ') + (q.why || '')
                        : isCorrect
                          ? (isEn ? 'Correct! ' : 'ถูกต้อง! ') + (q.why || '')
                          : (isEn ? 'Incorrect: ' : 'ผิด: ') + (q.why || '');

                    const metaRow = `<div class="muted" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:6px;">
                        ${
                            q.difficulty
                                ? `<span class="pill" style="opacity:0.9;">${escapeHtml(
                                      String(q.difficulty).toUpperCase()
                                  )}</span>`
                                : ''
                        }
                        ${
                            q.tags && q.tags.length
                                ? q.tags
                                      .map(
                                          (t) =>
                                              `<span class="pill" style="opacity:0.9;">${escapeHtml(
                                                  String(t)
                                              )}</span>`
                                      )
                                      .join('')
                                : ''
                        }
                    </div>`;

                    return `
            <div class="quiz-summary-item" style="margin:16px 0; padding:12px; border-radius:12px; background: rgba(0,0,0,0.25);">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                <span class="pill">${isEn ? 'Question ' : 'ข้อที่ '}${idx + 1}</span>
                <span class="muted">${
                    isCorrect
                        ? isEn
                            ? 'Correct'
                            : 'ตอบถูก'
                        : wasSkipped
                          ? isEn
                              ? 'Skipped'
                              : 'ข้าม'
                          : isEn
                            ? 'Incorrect'
                            : 'ตอบผิด'
                }</span>
              </div>
              <h4 style="margin:8px 0 6px 0;">${escapeHtml(String(q.q))}</h4>
              <div class="quiz-choices">${choiceHtml}</div>
              <div class="quiz-feedback" style="margin-top:6px; color:${fbColor}">${escapeHtml(
                  String(fbText)
              )}</div>
              ${metaRow}
            </div>`;
                })
                .join('');

            const skippedEntries = currentQuestions
                .map((q, idx) => ({ q, idx, r: responses[idx] }))
                .filter(
                    (x) => !x.r || x.r.selectedIndex === null || x.r.selectedIndex === undefined
                );
            const skippedCount = skippedEntries.length;
            const skippedSection =
                skippedCount > 0
                    ? `
                    <div style="margin-top:18px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.08);">
                        <h4 class="h3" style="margin:0 0 8px 0;">${isEn ? 'Skipped Questions' : 'ข้อที่ข้าม'}</h4>
                        <p class="muted" style="margin:0 0 10px 0;">${isEn ? `You skipped ${skippedCount} question(s).` : `คุณข้ามไป ${skippedCount} ข้อ`}</p>
                        <div class="quiz-skipped-list" style="display:grid; gap:10px;">
                            ${skippedEntries
                                .map((entry, sIdx) => {
                                    const q = entry.q;
                                    const correctText =
                                        typeof q.ans === 'number' &&
                                        q.choices &&
                                        q.choices[q.ans] !== undefined
                                            ? q.choices[q.ans]
                                            : '';
                                    return `
                                <div class="quiz-skipped-item" style="padding:12px; border-radius:12px; background: rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08);">
                                    <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; align-items:center;">
                                        <span class="pill">${isEn ? 'Skipped' : 'ข้าม'} ${sIdx + 1}</span>
                                        <span class="muted">${isEn ? 'Answer:' : 'เฉลย:'} <strong style="color:#e6e6f0;">${escapeHtml(String(correctText))}</strong></span>
                                    </div>
                                    <div style="margin-top:6px; font-weight:700;">${escapeHtml(String(q.q))}</div>
                                </div>`;
                                })
                                .join('')}
                        </div>
                    </div>`
                    : `
                    <div style="margin-top:18px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.08);">
                        <h4 class="h3" style="margin:0 0 8px 0;">${isEn ? 'Skipped Questions' : 'ข้อที่ข้าม'}</h4>
                        <p class="muted" style="margin:0;">${isEn ? 'No skipped questions — nice!' : 'ไม่มีข้อที่ข้าม — เยี่ยมเลย!'}</p>
                    </div>`;

            stage.innerHTML = `
        <div class="quiz-card animate-fadeInUp">
          <h3 class="h3">${isEn ? 'Summary: ' : 'สรุปผล: '}${currentTopic.toUpperCase()}</h3>
          <p class="muted">${isEn ? `You scored ${score}/${currentQuestions.length}` : `คุณทำได้ ${score}/${currentQuestions.length} ข้อ`}</p>
          <div style="margin-top:12px;">
            ${summaryItems}
          </div>
                    ${skippedSection}
          <div style="margin-top:1rem; display:flex; justify-content:flex-end; gap:8px;">
            <button type="button" class="btn ghost" data-quiz-action="retry">${isEn ? 'Try again' : 'ลองอีกครั้ง'}</button>
            <button type="button" class="btn ghost" data-quiz-action="menu">${isEn ? 'Back to Menu' : 'กลับไปที่เมนู'}</button>
          </div>
        </div>`;
            stage.querySelector('[data-quiz-action="retry"]').addEventListener('click', () => {
                window.startTopicQuiz(currentTopic);
            });
            stage.querySelector('[data-quiz-action="menu"]').addEventListener('click', () => {
                window.backToMenu();
            });
            // Smooth scroll to ensure the summary is visible
            setTimeout(() => {
                const quizSection = document.getElementById('final-quiz');
                if (quizSection && typeof quizSection.scrollIntoView === 'function') {
                    quizSection.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                    });
                }
            }, 50);
            return;
        }

        const q = currentQuestions[currentIndex];
        const bg = document.querySelector('.quiz-bg');
        if (bg) bg.className = 'quiz-bg ' + (q.bg || '');

        const tagsHtml =
            q.tags && q.tags.length
                ? `<div class="muted" style="display:flex; flex-wrap:wrap; gap:6px; margin:6px 0 0 0;">${q.tags
                      .map((t) => `<span class="pill" style="opacity:0.9">${escapeHtml(t)}</span>`)
                      .join('')}</div>`
                : '';
        const difficultyHtml = q.difficulty
            ? `<span class="pill" title="difficulty" style="background:rgba(255,255,255,0.14);">${escapeHtml(
                  String(q.difficulty).toUpperCase()
              )}</span>`
            : '';

        stage.innerHTML = `
            <div class="quiz-card animate-fadeInUp">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span class="pill">${escapeHtml(currentTopic.toUpperCase())}</span>
                    ${difficultyHtml}
                    <span class="muted">${isEn ? 'Question ' : 'ข้อที่ '}${currentIndex + 1} / ${
                        currentQuestions.length
                    }</span>
                </div>
                <h3 style="margin:8px 0 0 0;">${escapeHtml(q.q)}</h3>
                ${tagsHtml}
                <div class="quiz-choices" id="choices"></div>
                <div style="margin-top:8px; display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap;">
                    <button type="button" id="quiz-prev-btn" class="btn ghost">${isEn ? 'Previous' : 'ก่อนหน้า'}</button>
                    <button type="button" id="quiz-next-btn" class="btn primary">${isEn ? 'Skip' : 'ข้าม'}</button>
                </div>
            </div>`;

        document.getElementById('quiz-prev-btn').addEventListener('click', window.prevQuestion);
        document.getElementById('quiz-next-btn').addEventListener('click', window.nextOrSkip);

        const choicesEl = document.getElementById('choices');
        if (!choicesEl) return;

        q.choices.forEach((c, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'quiz-choice';
            btn.setAttribute('aria-pressed', 'false');
            btn.innerHTML = `<span class="quiz-choice-checkbox" aria-hidden="true"></span><span>${escapeHtml(c)}</span>`;
            btn.addEventListener('click', () => select(idx, btn));
            choicesEl.appendChild(btn);
        });

        // Restore previously selected answer visual state
        if (selectedAnswer !== null && selectedAnswer !== undefined) {
            const choiceEls = document.querySelectorAll('.quiz-choice');
            const el = choiceEls[selectedAnswer];
            if (el) {
                el.classList.add('selected');
                el.setAttribute('aria-pressed', 'true');
            }
        }

        // Update buttons state/labels
        updateNavButtons();
    }

    function select(idx, el) {
        selectedAnswer = idx;

        document.querySelectorAll('.quiz-choice').forEach((c) => {
            c.classList.remove('selected');
            c.setAttribute('aria-pressed', 'false');
        });
        el.classList.add('selected');
        el.setAttribute('aria-pressed', 'true');

        updateNavButtons();
    }

    function ensureResponseSlot(idx) {
        while (responses.length < currentQuestions.length) {
            responses.push({ selectedIndex: null, ts: Date.now() });
        }
        if (!responses[idx]) responses[idx] = { selectedIndex: null, ts: Date.now() };
    }

    function saveCurrentSelection() {
        ensureResponseSlot(currentIndex);
        responses[currentIndex].selectedIndex =
            selectedAnswer === null || selectedAnswer === undefined ? null : selectedAnswer;
        responses[currentIndex].ts = Date.now();
    }

    function updateNavButtons() {
        const isEn = window.currentLang === 'en';
        const prevBtn = document.getElementById('quiz-prev-btn');
        const nextBtn = document.getElementById('quiz-next-btn');

        if (prevBtn) {
            prevBtn.disabled = currentIndex <= 0;
            prevBtn.setAttribute('aria-disabled', currentIndex <= 0 ? 'true' : 'false');
        }

        if (nextBtn) {
            // If no answer selected, show Skip. Otherwise show Next.
            const hasAnswer = selectedAnswer !== null && selectedAnswer !== undefined;
            const isLastQuestion = currentIndex === currentQuestions.length - 1;
            nextBtn.textContent = hasAnswer
                ? isLastQuestion
                    ? isEn
                        ? 'Submit'
                        : 'ส่งคำตอบ'
                    : isEn
                      ? 'Next'
                      : 'ถัดไป'
                : isEn
                  ? 'Skip'
                  : 'ข้าม';
        }
    }

    window.nextOrSkip = function () {
        // Record selection (or null for skip) then advance
        saveCurrentSelection();
        currentIndex++;
        render();
    };

    window.prevQuestion = function () {
        // Save current selection before going back
        saveCurrentSelection();
        if (currentIndex > 0) {
            currentIndex--;
            render();
        }
    };

    window.startTopicQuiz = function (topic, questions) {
        // If questions are passed directly, use them (legacy support or manual override)
        if (questions) {
            initQuiz(topic, questions);
            return;
        }

        // Helper to extract correct lang questions
        const getLocalizedQuestions = (data) => {
            if (Array.isArray(data)) return data;
            if (data && (data.en || data.th)) {
                // Default to 'th' if currentLang is missing, or fallback to 'en' if 'th' is missing in data
                const lang = window.currentLang || 'th';
                return data[lang] || data['en'] || [];
            }
            return [];
        };

        // Check if data is already loaded
        if (window.quizData && window.quizData[topic]) {
            initQuiz(topic, getLocalizedQuestions(window.quizData[topic]));
            return;
        }

        // Fetch data for the topic

        // Determine path relative to current page location to support GitHub Pages / subdirs
        // If we are in 'lessons/' folder, go up one level to find 'data/'
        const pathPrefix = window.location.pathname.includes('/lessons/') ? '../' : '';
        const url = `${pathPrefix}data/quiz-${topic}.json`;

        fetch(url)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then((data) => {
                window.quizData[topic] = data;
                initQuiz(topic, getLocalizedQuestions(data));
            })
            .catch((err) => {
                console.error(`Failed to load quiz data for ${topic}:`, err);
                const stage = getStage();
                if (!stage) return;
                const isEn = window.currentLang === 'en';
                stage.innerHTML = `<div class="quiz-card"><h3 style="color:#f87171">Error loading quiz</h3><p>${escapeHtml(
                    isEn ? 'Could not load the quiz data' : 'ไม่สามารถโหลดข้อมูลแบบทดสอบได้'
                )} (${escapeHtml(err.message)})</p>
                    <button type="button" class="btn primary" data-quiz-action="retry">${isEn ? 'Try again' : 'ลองอีกครั้ง'}</button></div>`;
                stage.querySelector('[data-quiz-action="retry"]').addEventListener('click', () => {
                    window.startTopicQuiz(topic);
                });
                const quizSection = document.getElementById('final-quiz');
                if (quizSection) quizSection.style.display = 'block';
            });
    };

    function initQuiz(topic, questions) {
        if (!Array.isArray(questions) || questions.length === 0) {
            console.error('Invalid quiz questions for topic:', topic, 'Data:', questions);
            return;
        }

        currentTopic = topic;
        // Deep copy to avoid mutating original question banks
        currentQuestions = questions.map((q) => ({
            ...q,
            choices: Array.isArray(q.choices) ? [...q.choices] : [],
        }));

        // Shuffle questions and choices
        shuffleArray(currentQuestions);
        currentQuestions = currentQuestions.map(shuffleChoicesOnQuestion);

        // Cap at max questions
        if (currentQuestions.length > MAX_QUESTIONS) {
            currentQuestions = currentQuestions.slice(0, MAX_QUESTIONS);
        }

        // Reset state
        currentIndex = 0;
        score = 0;
        responses = [];

        // Show quiz section
        const quizSection = document.getElementById('final-quiz');
        if (quizSection) {
            quizSection.style.display = 'block';
            quizSection.classList.add('is-visible');
        }

        setTimeout(render, RENDER_DELAY);
        setTimeout(scrollToQuiz, SCROLL_DELAY);
    }
})();
