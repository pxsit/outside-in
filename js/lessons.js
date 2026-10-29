// Lesson content loader.
// Lesson text lives in data/lessons/<topic>.json as { th: {name, bg, pages[]}, en: {...} }.
// window.loadLesson(topic) resolves to the lesson for the current language and caches the
// fetched file so switching language does not hit the network again.
(function () {
    const cache = {};

    window.loadLesson = function (topic) {
        if (!cache[topic]) {
            cache[topic] = fetch(`../data/lessons/${encodeURIComponent(topic)}.json`)
                .then((response) => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json();
                })
                .catch((err) => {
                    delete cache[topic]; // allow a retry
                    throw err;
                });
        }
        return cache[topic].then((data) => data[window.currentLang] || data.th);
    };
})();
