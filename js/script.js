'use strict';

(function () {
  let staffData = [];

  const dom = {
    searchInput: document.getElementById('searchInput'),
    searchClear: document.getElementById('searchClear'),
    resultsGrid: document.getElementById('resultsGrid'),
    resultsContainer: document.getElementById('resultsContainer'),
    promptState: document.getElementById('promptState'),
    emptyState: document.getElementById('emptyState'),
    loadingState: document.getElementById('loadingState'),
    totalStaff: document.getElementById('totalStaff'),
    deptCount: document.getElementById('deptCount'),
    themeToggle: document.getElementById('themeToggle'),
    scrollTopBtn: document.getElementById('scrollTopBtn'),
  };

  // =====================================
  // UTILITIES
  // =====================================

  function removeVietnameseTones(str) {
    if (!str) return '';
    str = str.toLowerCase();
    str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    str = str.replace(/đ/g, 'd');
    str = str.replace(/[^a-z0-9\s]/g, ' ');
    str = str.replace(/\s+/g, ' ').trim();
    return str;
  }

  function highlightMatch(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query.split(' ').join('|')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  // =====================================
  // STATE MANAGEMENT
  // =====================================

  function showState(state) {
    dom.promptState.hidden = state !== 'prompt';
    dom.emptyState.hidden = state !== 'empty';
    dom.loadingState.hidden = state !== 'loading';
    dom.resultsGrid.hidden = state !== 'results';
  }

  function renderStats() {
    dom.totalStaff.textContent = staffData.length;
    const depts = new Set(staffData.map(s => s.department).filter(Boolean));
    dom.deptCount.textContent = depts.size;
  }

  // =====================================
  // AQUATIC SCENE BUBBLES
  // =====================================

  function initAquaticScene() {
    const scene = document.getElementById('aquaticScene');
    if (!scene) return;

    const bubblesContainer = scene.querySelector('.bubbles-container');
    if (!bubblesContainer) return;

    // Check if reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    // Generate a single bubble with randomized size, drift, speed and origin
    function createBubble(originX, sizeMin, sizeMax) {
      const bubble = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      bubble.setAttribute('class', 'bubble bubble-rise');

      const radius = Math.random() * (sizeMax - sizeMin) + sizeMin;
      const x = originX !== undefined ? originX : Math.random() * 180 + 10;
      const y = 195;
      const drift = (Math.random() * 16 - 8).toFixed(1); // -8px to 8px horizontal sway
      const duration = (Math.random() * 1.8 + 2.6).toFixed(2); // 2.6s - 4.4s
      const delay = (Math.random() * 0.3).toFixed(2);

      bubble.setAttribute('cx', x);
      bubble.setAttribute('cy', y);
      bubble.setAttribute('r', radius.toFixed(1));
      bubble.style.setProperty('--drift', `${drift}px`);
      bubble.style.animationDuration = `${duration}s`;
      bubble.style.animationDelay = `${delay}s`;

      bubblesContainer.appendChild(bubble);

      // Remove after animation completes
      setTimeout(() => {
        bubble.remove();
      }, (parseFloat(duration) + parseFloat(delay)) * 1000 + 100);
    }

    // Occasionally spawn a small cluster of bubbles together (like a creature exhaling)
    function spawnBurst() {
      const originX = Math.random() * 160 + 20;
      const count = Math.floor(Math.random() * 2) + 2; // 2-3 bubbles
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          createBubble(originX + (Math.random() * 10 - 5), 1, 2.5);
        }, i * 120);
      }
    }

    // Seed a few bubbles immediately so the scene feels alive on load
    for (let i = 0; i < 3; i++) {
      setTimeout(() => createBubble(undefined, 1.5, 4), i * 300);
    }

    // Steady single bubbles every ~650ms, with occasional bursts
    const bubbleInterval = setInterval(() => {
      if (!document.contains(scene)) {
        clearInterval(bubbleInterval);
        return;
      }
      if (Math.random() < 0.22) {
        spawnBurst();
      } else {
        createBubble(undefined, 1.5, 4.5);
      }
    }, 650);
  }

  // =====================================
  // RENDER RESULTS
  // =====================================

  function renderResults(results, query) {
    dom.resultsGrid.innerHTML = results.map(staff => {
      const normalizedQuery = removeVietnameseTones(query);
      const nameHighlight = highlightMatch(staff.name, query);
      const deptHighlight = highlightMatch(staff.department, query);

      return `
        <div class="result-card">
          <div class="result-header">
            <div class="result-badge">${staff.role || 'Nhân sự'}</div>
            <h3 class="result-name">${nameHighlight}</h3>
          </div>
          <div class="result-body">
            ${staff.department ? `
              <div class="result-row">
                <span class="result-label">Bộ phận</span>
                <span class="result-value">${deptHighlight}</span>
              </div>
            ` : ''}
            ${staff.phone ? `
              <div class="result-row">
                <span class="result-label">Điện thoại</span>
                <span class="result-value">${staff.phone}</span>
              </div>
            ` : ''}
            ${staff.email ? `
              <div class="result-row">
                <span class="result-label">Email</span>
                <span class="result-value">${staff.email}</span>
              </div>
            ` : ''}
            ${staff.room ? `
              <div class="result-row">
                <span class="result-label">Phòng</span>
                <span class="result-value">${staff.room}</span>
              </div>
            ` : ''}
            ${staff.clerks && staff.clerks.length > 0 ? `
              <div class="result-row">
                <span class="result-label">Thư ký</span>
                <div>
                  <ul class="result-list">
                    ${staff.clerks.map(clerk => `<li>${highlightMatch(clerk.name, query)}${clerk.room ? ` <span class="clerk-room">(P. ${highlightMatch(clerk.room, query)})</span>` : ''}</li>`).join('')}
                  </ul>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    showState('results');
    renderStats();
  }

  // =====================================
  // SEARCH LOGIC
  // =====================================

  function search(query) {
    const trimmed = query.trim();

    if (!trimmed) {
      showState('prompt');
      return;
    }

    const normalizedQuery = removeVietnameseTones(trimmed);

    const results = staffData.filter(staff => {
      const nameMatch = removeVietnameseTones(staff.name).includes(normalizedQuery);
      const deptMatch = staff.department && removeVietnameseTones(staff.department).includes(normalizedQuery);
      const phoneMatch = staff.phone && staff.phone.includes(trimmed);
      const emailMatch = staff.email && staff.email.toLowerCase().includes(trimmed.toLowerCase());
      const roomMatch = staff.room && staff.room.toString().includes(trimmed);
      const clerksMatch = staff.clerks && staff.clerks.some(clerk =>
        removeVietnameseTones(clerk.name).includes(normalizedQuery) ||
        (clerk.room && clerk.room.toString().includes(trimmed))
      );

      return nameMatch || deptMatch || phoneMatch || emailMatch || roomMatch || clerksMatch;
    });

    if (results.length === 0) {
      showState('empty');
    } else {
      renderResults(results, trimmed);
    }
  }

  // =====================================
  // EVENT LISTENERS
  // =====================================

  dom.searchInput.addEventListener('input', (e) => {
    const query = e.target.value;
    dom.searchClear.hidden = !query;
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => search(query), 150);
  });

  dom.searchClear.addEventListener('click', () => {
    dom.searchInput.value = '';
    dom.searchClear.hidden = true;
    showState('prompt');
    dom.searchInput.focus();
  });

  dom.themeToggle.addEventListener('click', () => {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
  });

  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
      dom.scrollTopBtn.classList.add('visible');
    } else {
      dom.scrollTopBtn.classList.remove('visible');
    }
  });

  dom.scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // =====================================
  // INITIALIZE
  // =====================================

  async function init() {
    // Set theme from localStorage
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Set copyright year
    const copyrightYear = document.getElementById('copyrightYear');
    if (copyrightYear) {
      copyrightYear.textContent = new Date().getFullYear();
    }

    initAquaticScene();

    try {
      showState('loading');
      const res = await fetch('data/staffs.json');
      if (!res.ok) throw new Error('Failed to load data');
      staffData = await res.json();
      
      if (!Array.isArray(staffData)) {
        throw new Error('Invalid data format');
      }

      renderStats();
      showState('prompt');
    } catch (err) {
      console.error('Error loading staff data:', err);
      showState('empty');
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();