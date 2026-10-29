/* global gsap, ScrollTrigger */

// Safe localStorage access (can throw in private mode or with blocked site data)
const storage = {
    get(key) {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch {
            /* storage unavailable, ignore */
        }
    },
};

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const isLessonPage = window.location.pathname.includes('/lessons/');
const basePath = isLessonPage ? '../' : '';

// Strip tracking parameters from the URL
const TRACKING_PARAMS = [
    ...['source', 'medium', 'term', 'campaign', 'content', 'name', 'cid', 'reader', 'viz_id'].map(
        (s) => `utm_${s}`
    ),
    'utm_pubreferrer',
    'utm_swu',
    'ICID',
    'icid',
    '_hsenc',
    '_hsmi',
    'mkt_tok',
    'mc_cid',
    'mc_eid',
    ...['source', 'mchannel', 'campaign', 'linkname', 'fee'].map((s) => `ns_${s}`),
    'sr_share',
    'vero_conv',
    'vero_id',
    'fbclid',
    'igshid',
    'srcid',
    'gclid',
    'ocid',
    'ncid',
    'nr_email_referer',
    'ref',
    'spm',
];

function stripTrackingParams() {
    try {
        const url = new URL(window.location.href);
        const present = TRACKING_PARAMS.filter((p) => url.searchParams.has(p));
        if (present.length === 0) return;
        present.forEach((p) => url.searchParams.delete(p));
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch {
        /* URL parsing failed, ignore */
    }
}

document.addEventListener('DOMContentLoaded', function () {
    stripTrackingParams();

    const initFunctions = [
        ['Navigation', initNavigation],
        ['Animations', initAnimations],
        ['ScrollEffects', initScrollEffects],
        ['Particles', createParticles],
        ['HeroVideo', initHeroVideo],
        ['ButtonBindings', initButtonBindings],
        ['Language', initLanguage],
    ];

    initFunctions.forEach(([name, fn]) => {
        try {
            fn();
        } catch (error) {
            console.error(`Init ${name} error:`, error);
        }
    });
});

function scrollToId(id) {
    const target = document.querySelector(id);
    if (!target) return;
    target.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
    });
}

function initButtonBindings() {
    const heroStartBtn = document.getElementById('hero-start-btn');
    if (heroStartBtn) {
        heroStartBtn.addEventListener('click', () => {
            scrollToId('#menu');
            history.pushState(null, '', '#menu');
        });
    }
}

// Language handling
window.currentLang = storage.get('site_lang') || 'th';
let locales = {};

// Translate a key for the current language, falling back to Thai, then to the key itself
window.t = function (key, vars) {
    const text = locales[window.currentLang]?.[key] ?? locales.th?.[key] ?? key;
    if (!vars) return text;
    return text.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? vars[name] : `{${name}}`));
};

function initLanguage() {
    // Bind the toggle first so it still flips the language even if locales fail to load
    const toggleBtn = document.getElementById('lang-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            setLanguage(window.currentLang === 'th' ? 'en' : 'th');
        });
    }

    fetch(`${basePath}data/locales.json`)
        .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then((data) => {
            locales = data;
        })
        .catch((e) => {
            // Page keeps its built-in Thai text; lesson content does not depend on locales
            console.error('Failed to load locales', e);
        })
        .finally(() => setLanguage(window.currentLang));
}

function setLanguage(lang) {
    window.currentLang = lang;
    storage.set('site_lang', lang);
    document.documentElement.lang = lang;

    const langSpan = document.getElementById('current-lang');
    if (langSpan) langSpan.textContent = lang.toUpperCase();

    const toggleBtn = document.getElementById('lang-toggle');
    if (toggleBtn) {
        toggleBtn.setAttribute(
            'aria-label',
            lang === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'
        );
    }

    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const text = locales[lang]?.[el.getAttribute('data-i18n')];
        if (text) el.textContent = text;
    });

    window.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }));
}

function initNavigation() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');

    if (!hamburger || !navMenu) return;

    const setMenuOpen = (open) => {
        hamburger.classList.toggle('active', open);
        navMenu.classList.toggle('active', open);
        hamburger.setAttribute('aria-expanded', String(open));
    };

    hamburger.addEventListener('click', () => setMenuOpen(!navMenu.classList.contains('active')));

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navMenu.classList.contains('active')) {
            setMenuOpen(false);
            hamburger.focus();
        }
    });

    navLinks.forEach((link) => {
        link.addEventListener('click', (e) => {
            setMenuOpen(false);
            const href = link.getAttribute('href');
            // Only hash links are handled here; other links navigate normally
            if (!href || !href.startsWith('#')) return;
            e.preventDefault();
            scrollToId(href);
            history.pushState(null, '', href);
        });
    });
}

function initAnimations() {
    if (typeof gsap === 'undefined' || prefersReducedMotion()) return;

    gsap.from('.hero-title', { duration: 1, y: 50, opacity: 0, ease: 'power3.out' });

    if (typeof ScrollTrigger !== 'undefined' && document.querySelector('.menu-grid')) {
        gsap.registerPlugin(ScrollTrigger);
        gsap.from('.menu-card', {
            scrollTrigger: {
                trigger: '.menu-grid',
                start: 'top 80%',
                toggleActions: 'play none none none',
            },
            duration: 0.8,
            y: 40,
            opacity: 0,
            stagger: 0.15,
            ease: 'power3.out',
        });
    }
}

function initScrollEffects() {
    const sections = document.querySelectorAll('section:not(.hero)');

    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    sections.forEach((section) => {
        section.classList.add('fade-in-section');
        observer.observe(section);
    });

    const header = document.querySelector('.header');
    if (!header) return;

    window.addEventListener(
        'scroll',
        throttle(() => header.classList.toggle('scrolled', window.scrollY > 100), 100),
        { passive: true }
    );
}

function createParticles() {
    const hero = document.querySelector('.hero');
    if (!hero || prefersReducedMotion()) return;

    const particlesContainer = document.createElement('div');
    particlesContainer.className = 'particles';
    particlesContainer.setAttribute('aria-hidden', 'true');

    const fragment = document.createDocumentFragment();
    const PARTICLE_COUNT = 24;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.cssText = `
            left: ${Math.random() * 100}%;
            animation-delay: ${Math.random() * 10}s;
            animation-duration: ${5 + Math.random() * 10}s;
        `;
        fragment.appendChild(particle);
    }

    particlesContainer.appendChild(fragment);
    hero.appendChild(particlesContainer);
}

// Hero video: fades to black at the end and restarts. Stays on the poster image when the
// user prefers reduced motion or has data saver on.
function initHeroVideo() {
    const video = document.getElementById('hero-video');
    const fade = document.getElementById('hero-video-fade');
    const fallback = document.querySelector('.fallback-visual');
    if (!video || !fade) return;

    const wrap = video.closest('.hero-video-wrap');

    if (prefersReducedMotion() || navigator.connection?.saveData) {
        video.preload = 'none';
        return;
    }

    const startPlayback = () => {
        const p = video.play();
        if (p && typeof p.catch === 'function') {
            // Autoplay blocked: the poster stays visible
            p.catch(() => {});
        }
    };

    if (video.readyState >= 1) startPlayback();
    else video.addEventListener('loadedmetadata', startPlayback, { once: true });

    video.addEventListener('ended', () => {
        fade.classList.add('show');
        setTimeout(() => {
            video.currentTime = 0;
            setTimeout(() => {
                fade.classList.remove('show');
                startPlayback();
            }, 250);
        }, 150);
    });

    // Pause when scrolled out of view to save CPU and battery
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) video.pause();
            else if (video.paused && !video.ended) startPlayback();
        }).observe(video);
    }

    const showFallback = () => {
        if (fallback) fallback.style.display = 'block';
        if (wrap) wrap.style.display = 'none';
    };
    video.addEventListener('error', showFallback);
    video.addEventListener('stalled', () => {
        if (video.currentTime === 0) showFallback();
    });
}

function showErrorMessage(message) {
    document.querySelectorAll('.error-toast').forEach((t) => t.remove());

    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.textContent = message;
    toast.setAttribute('role', 'alert');
    toast.addEventListener('click', () => toast.remove());
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 5000);
}

function throttle(func, limit) {
    let lastCall = 0;
    return function (...args) {
        const now = Date.now();
        if (now - lastCall >= limit) {
            lastCall = now;
            func.apply(this, args);
        }
    };
}

window.addEventListener('error', (e) => {
    console.error('Application error:', e.error);
    // Ignore errors from third-party scripts and resource load failures
    if (!e.filename || !e.filename.startsWith(window.location.origin)) return;
    showErrorMessage(window.t ? window.t('error_generic') : 'Error');
});
