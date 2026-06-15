(function () {
  'use strict';

  const DOC_FILES = [
    'setup-openclaw.md',
    'setup-ollama.md',
    'setup-claude-code.md',
    'setup-github-copilot.md',
    'observability-architecture.md',
    'telemetry-gaps.md',
    'setup-opencode.md',
  ];

  const SLIDE_INDEX = 'slides/index.json';

  // ── Theme ────────────────────────────────────────────

  function initTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.dataset.theme = saved === 'light' ? 'light' : '';
    document.getElementById('theme-toggle').addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'light' ? '' : 'light';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('theme', next === 'light' ? 'light' : 'dark');
    });
  }

  // ── Section routing ───────────────────────────────────

  let revealInitialised = false;

  function showSection(name) {
    const views = {
      about:  document.getElementById('about-view'),
      slides: document.getElementById('slides-view'),
      docs:   document.getElementById('docs-view'),
    };

    Object.entries(views).forEach(([key, el]) => { el.hidden = key !== name; });
    document.body.classList.toggle('slides-active', name === 'slides');

    if (name === 'docs' && DOC_FILES.length && !document.querySelector('#docs-nav a')) {
      buildDocsNav();
      loadDoc(DOC_FILES[0]);
    }
    if (name === 'slides' && !revealInitialised) initReveal();

    // wire internal about-page links
    document.querySelectorAll('#about-content [data-section]').forEach(el => {
      el.addEventListener('click', e => { e.preventDefault(); showSection(el.dataset.section); });
    });

    document.querySelectorAll('#site-nav [data-section]').forEach(el => {
      el.removeAttribute('aria-current');
      if (el.dataset.section === name) el.setAttribute('aria-current', 'page');
    });
  }

  function initNav() {
    document.querySelectorAll('#site-nav [data-section]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        showSection(el.dataset.section);
      });
    });

    document.getElementById('slides-back-btn').addEventListener('click', () => showSection('about'));

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && document.body.classList.contains('slides-active')) {
        showSection('about');
        e.stopPropagation();
      }
    }, true);
  }

  // ── Docs ─────────────────────────────────────────────

  function buildDocsNav() {
    const nav = document.getElementById('docs-nav');
    DOC_FILES.forEach(file => {
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = file.replace(/\.md$/, '').replace(/-/g, ' ');
      a.dataset.file = file;
      a.addEventListener('click', e => {
        e.preventDefault();
        loadDoc(file);
      });
      nav.appendChild(a);
    });
  }

  function loadDoc(file) {
    document.querySelectorAll('#docs-nav a').forEach(a => {
      a.classList.toggle('active', a.dataset.file === file);
    });
    const content = document.getElementById('docs-content');
    content.innerHTML = '<p>Loading…</p>';
    fetch('docs/' + file)
      .then(r => {
        if (!r.ok) throw new Error(r.status);
        return r.text();
      })
      .then(md => {
        content.innerHTML = marked.parse(md);
        renderMermaid(content);
      })
      .catch(() => { content.innerHTML = '<p>Could not load ' + file + '.</p>'; });
  }

  async function renderMermaid(container) {
    const blocks = container.querySelectorAll('pre code.mermaid, pre code.language-mermaid');
    if (!blocks.length) return;

    const isDark = document.documentElement.dataset.theme !== 'light';
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'default',
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 13,
    });

    for (let i = 0; i < blocks.length; i++) {
      const code = blocks[i];
      const pre = code.parentElement;
      const id = 'mermaid-' + i + '-' + Date.now();
      try {
        const { svg } = await mermaid.render(id, code.textContent.trim());
        const div = document.createElement('div');
        div.className = 'mermaid-diagram';
        div.innerHTML = svg;
        pre.replaceWith(div);
      } catch (e) {
        console.warn('Mermaid render error:', e);
      }
    }
  }

  // ── Reveal.js ────────────────────────────────────────

  function initReveal() {
    revealInitialised = true;

    fetch(SLIDE_INDEX)
      .then(r => r.json())
      .then(files => Promise.all(files.map(f => fetch('slides/' + f).then(r => r.text()))))
      .then(sections => {
        const container = document.getElementById('reveal-slides');
        sections.forEach(md => {
          const section = document.createElement('section');
          section.setAttribute('data-markdown', '');
          const template = document.createElement('textarea');
          template.setAttribute('data-template', '');
          template.textContent = md;
          section.appendChild(template);
          container.appendChild(section);
        });

        // Apply structural classes BEFORE Reveal.initialize() so the scale
        // calculation sees the correct CSS (dense/wide) from the start.
        const addSlideClass = (idx, ...classes) => {
          const el = container.children[idx];
          if (el) classes.forEach(c => el.classList.add(c));
        };
        addSlideClass(0, 'slide-title');
        addSlideClass(1, 'slide-disclaimers');
        addSlideClass(2, 'slide-wide');   // openclaw-prompt.png is tiny — needs width: 90%
        addSlideClass(4, 'slide-dense');
        addSlideClass(8, 'slide-dense');

        Reveal.initialize({
          plugins: [RevealMarkdown, RevealNotes],
          hash: false,
          controls: true,
          progress: true,
          center: false,
          transition: 'none',
          backgroundTransition: 'none',
          width: '100%',
          height: '100%',
          margin: 0.08,
          minScale: 0.2,
          maxScale: 2.0,
        });

        Reveal.on('ready', () => {
          // Wrap consecutive image paragraphs in a flex gallery container
          Reveal.getSlides().forEach(slide => {
            const imgParas = [...slide.querySelectorAll('p')].filter(p => p.querySelector('img'));
            if (imgParas.length >= 2) {
              const gallery = document.createElement('div');
              gallery.className = 'image-gallery';
              imgParas[0].parentNode.insertBefore(gallery, imgParas[0]);
              imgParas.forEach(p => gallery.appendChild(p));
            }
          });

          renderMermaid(document.getElementById('reveal-slides'));
        });
      })
      .catch(err => {
        document.getElementById('reveal-slides').innerHTML =
          '<section><h2>Could not load slides</h2><p>' + err + '</p></section>';
        Reveal.initialize({ plugins: [RevealNotes] });
      });
  }

  // ── Boot ─────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    initTheme();
    initNav();
    const params = new URLSearchParams(window.location.search);
    const isRevealEmbed = params.has('postMessageEvents') || params.get('controls') === 'false';
    showSection(isRevealEmbed ? 'slides' : 'about');
  });
}());
