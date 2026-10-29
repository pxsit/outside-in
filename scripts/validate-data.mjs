// Sanity checks for the content in data/: quiz banks, lesson JSON and locale parity.
// Run with `npm run validate`.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const errors = [];
const fail = (msg) => errors.push(msg);
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

// Quiz banks
for (const file of readdirSync('data').filter((f) => f.startsWith('quiz-'))) {
    const data = readJson(join('data', file));
    for (const lang of ['th', 'en']) {
        const questions = data[lang];
        if (!Array.isArray(questions) || questions.length === 0) {
            fail(`${file}: missing "${lang}" questions`);
            continue;
        }
        questions.forEach((q, i) => {
            const where = `${file} [${lang}] #${i + 1}`;
            if (!q.q) fail(`${where}: empty question`);
            if (!Array.isArray(q.choices) || q.choices.length < 2)
                fail(`${where}: needs 2+ choices`);
            else if (!Number.isInteger(q.ans) || q.ans < 0 || q.ans >= q.choices.length)
                fail(`${where}: "ans" ${q.ans} out of range`);
            if (!q.why) fail(`${where}: missing explanation ("why")`);
        });
    }
    if (data.th?.length !== data.en?.length)
        fail(`${file}: th has ${data.th?.length} questions, en has ${data.en?.length}`);
}

// Lessons: same page count in both languages, and every referenced asset exists
for (const file of readdirSync('data/lessons')) {
    const data = readJson(join('data/lessons', file));
    if (data.th.pages.length !== data.en.pages.length)
        fail(
            `lessons/${file}: th has ${data.th.pages.length} pages, en has ${data.en.pages.length}`
        );
    for (const lang of ['th', 'en']) {
        for (const page of data[lang].pages) {
            for (const [, src] of page.html.matchAll(/(?:src|href)="\.\.\/(assets\/[^"]+)"/g)) {
                if (!existsSync(src)) fail(`lessons/${file} [${lang}]: missing ${src}`);
            }
            if (/<img\b(?![^>]*\balt=)/.test(page.html))
                fail(`lessons/${file} [${lang}] "${page.title}": <img> without alt`);
        }
    }
}

// Locales: both languages define the same keys
const locales = readJson('data/locales.json');
for (const key of Object.keys(locales.th))
    if (!(key in locales.en)) fail(`locales: "${key}" missing in en`);
for (const key of Object.keys(locales.en))
    if (!(key in locales.th)) fail(`locales: "${key}" missing in th`);

if (errors.length) {
    console.error(errors.map((e) => `✗ ${e}`).join('\n'));
    process.exit(1);
}
console.log('Data OK');
