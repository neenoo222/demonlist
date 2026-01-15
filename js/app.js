// Data is loaded globally from data.js

class DemonListApp {
    constructor() {
        this.state = {
            levels: [], // Start empty, fill from API
            currentLevelId: null,
            filter: '',
            sortBy: 'rank',
            focusedIndex: 0,
            isLoading: true,
            currentView: 'main' // 'main', 'stats', 'roulette'
        };

        this.els = {
            listContainer: document.getElementById('demon-list-container'),
            searchInput: document.getElementById('search-input'),
            detailView: document.getElementById('level-detail-view'),
            btnSort: document.getElementById('btn-sort'),
            btnRandom: document.getElementById('btn-random'),
            // Note: Navigation elements are set up in setupNavigation
        };

        this.colorThief = new ColorThief();
        this.init();
    }

    init() {
        this.fetchLevels();
        this.setupEventListeners();
        this.setupKeyboardNav();
        this.setupNavigation();
        this.initRoulette();
        this.initTiltEffect();
    }

    initTiltEffect() {
        // Simple Vanilla Tilt Implementation
        document.addEventListener('mousemove', (e) => {
            const cards = document.querySelectorAll('.tilt-card');
            cards.forEach(card => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                // Check if mouse is near/over the card to activate (optimization)
                // Expanding the hit area slightly or just checking if it is within reasonable bounds
                // For this localized effect, we want it mainly when hovering
                const isHovering = x >= 0 && x <= rect.width && y >= 0 && y <= rect.height;

                if (isHovering) {
                    const centerX = rect.width / 2;
                    const centerY = rect.height / 2;

                    // Max rotation deg
                    const maxRot = 10;

                    const rotateX = ((y - centerY) / centerY) * -maxRot;
                    const rotateY = ((x - centerX) / centerX) * maxRot;

                    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
                    card.style.transition = 'transform 0.1s ease-out';
                } else {
                    // Reset if we moved away (and check if we weren't already reset to avoid layout thrashing)
                    if (card.style.transform !== 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)' && card.style.transform !== '') {
                        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
                        card.style.transition = 'transform 0.5s ease-out';
                    }
                }
            });
        });
    }

    async fetchLevels() {
        this.els.listContainer.innerHTML = '<div class="loader"></div>';
        try {
            const response = await fetch('https://pointercrate.com/api/v2/demons/listed/?limit=100');
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();

            this.state.levels = data.map(d => ({
                rank: d.position,
                name: d.name,
                creator: d.publisher.name, // Using publisher as creator
                verifier: d.verifier.name,
                id: d.id.toString(), // Pointercrate ID for API calls
                level_id: d.level_id.toString(), // GD ID for display
                points: this.calculatePoints(d.position), // Helper to calc points
                image: d.thumbnail,
                video: d.video,
                length: "XL", // Default, API doesn't allow easy sort by length in this view
                victors: null, // API doesn't return victors in list view, null = not loaded
                about: `Verified by ${d.verifier.name}. Published by ${d.publisher.name}.`
            }));
        } catch (error) {
            console.error('API Load failed, falling back to static data', error);
            // Fallback to window.demons if available
            if (window.demons) {
                this.state.levels = [...window.demons];
                // Try to patch static data with proper points if missing
                this.state.levels.forEach(l => l.points = l.points || this.calculatePoints(l.rank));
            } else {
                this.els.listContainer.innerHTML = '<p class="text-red-500 text-center p-4">Failed to load data.</p>';
                return;
            }
        } finally {
            this.state.isLoading = false;
            this.renderList();
            if (this.state.levels.length > 0) {
                this.selectLevel(this.state.levels[0].id);
            }
            this.renderStats(); // Calculate stats once data is loaded
        }
    }

    calculatePoints(rank) {
        if (rank > 150) return "0.00";
        // Pointercrate Formula approximation
        // Base: (100 / sqrt((rank - 1) / 50 + 0.444444) - 50)
        // Scaled by 2.5 to match max 250 points
        const score = 2.5 * (100 / Math.sqrt((rank - 1) / 50 + 0.444444) - 50);
        return score.toFixed(2);
    }

    setupEventListeners() {
        // Search
        this.els.searchInput.addEventListener('input', (e) => {
            if (this.state.currentView !== 'main') this.switchView('main');
            this.state.filter = e.target.value.toLowerCase();
            this.state.focusedIndex = 0;
            this.renderList();
        });

        // Sorting
        this.els.btnSort.addEventListener('click', () => {
            if (this.state.sortBy === 'rank') {
                this.state.sortBy = 'points';
                this.els.btnSort.innerHTML = '<span class="material-icons">trending_down</span> Points';
                this.state.levels.sort((a, b) => {
                    const pA = parseFloat(a.points) || 0;
                    const pB = parseFloat(b.points) || 0;
                    return pB - pA;
                });
            } else {
                this.state.sortBy = 'rank';
                this.els.btnSort.innerHTML = '<span class="material-icons">format_list_numbered</span> Rank';
                this.state.levels.sort((a, b) => a.rank - b.rank);
            }
            this.renderList();
            this.selectLevel(this.state.levels[0].id);
        });

        // Random (Surprise Me in Sidebar)
        this.els.btnRandom.addEventListener('click', () => {
            // Switch to main view if not already
            if (this.state.currentView !== 'main') this.switchView('main');
            const randomIndex = Math.floor(Math.random() * this.state.levels.length);
            const randomLevel = this.state.levels[randomIndex];
            this.selectLevel(randomLevel.id);
            // Scroll to it in list
            const listItem = document.querySelector(`[data-id="${randomLevel.id}"]`);
            if (listItem) listItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }

    setupNavigation() {
        this.els.nav = {
            main: document.getElementById('nav-main'),
            stats: document.getElementById('nav-stats'),
            roulette: document.getElementById('nav-roulette'),
            legacy: document.getElementById('nav-legacy')
        };

        this.els.views = {
            main: document.getElementById('level-detail-view'),
            stats: document.getElementById('stats-view'),
            roulette: document.getElementById('roulette-view')
        };

        // Navigation Clicks
        this.els.nav.main.addEventListener('click', (e) => { e.preventDefault(); this.switchView('main'); });
        this.els.nav.stats.addEventListener('click', (e) => { e.preventDefault(); this.switchView('stats'); });
        this.els.nav.roulette.addEventListener('click', (e) => { e.preventDefault(); this.switchView('roulette'); });
        this.els.nav.legacy.addEventListener('click', (e) => { e.preventDefault(); alert('Legacy List coming soon!'); });
    }

    switchView(viewName) {
        this.state.currentView = viewName;

        // Update Nav Active State
        Object.values(this.els.nav).forEach(el => {
            if (el) { // Legacy might be null or handled differently
                el.classList.remove('text-white', 'after:w-full');
                el.classList.add('hover:text-white', 'hover:text-glow', 'after:w-0');
                // Reset underline styles basically
                // Currently only Main list has the complex style in HTML. 
                // Let's standardise active state logic visually.
                // Ideally we toggle a class that adds the underline.
            }
        });

        // Simple active state toggle for now (improving the HTML structure later would be better but this works)
        const activeNav = this.els.nav[viewName];
        if (activeNav) {
            activeNav.classList.remove('hover:text-white', 'hover:text-glow');
            activeNav.classList.add('text-white');
            // We'll manage the underline manually via class manipulation if we want animations,
            // or just rely on the text color for now to keep it simple and robust.
        }

        // Hide all views
        Object.values(this.els.views).forEach(el => {
            el.classList.add('hidden');
            el.classList.remove('fade-in');
        });

        // Show selected view
        const view = this.els.views[viewName];
        view.classList.remove('hidden');
        void view.offsetWidth; // Reflow for animation
        view.classList.add('fade-in');
    }

    setupKeyboardNav() {
        document.addEventListener('keydown', (e) => {
            if (this.state.currentView !== 'main') return; // Only nav in main view

            const visibleLevels = this.getVisibleLevels();
            if (visibleLevels.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.state.focusedIndex = Math.min(this.state.focusedIndex + 1, visibleLevels.length - 1);
                this.selectLevel(visibleLevels[this.state.focusedIndex].id, true);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.state.focusedIndex = Math.max(this.state.focusedIndex - 1, 0);
                this.selectLevel(visibleLevels[this.state.focusedIndex].id, true);
            }
        });
    }

    getVisibleLevels() {
        if (!this.state.filter) return this.state.levels;
        return this.state.levels.filter(l => l.name.toLowerCase().includes(this.state.filter));
    }

    selectLevel(id, scrollToList = false) {
        if (this.state.currentView !== 'main') this.switchView('main'); // Switch back if clicking from elsewhere (unlikely but safe)

        const level = this.state.levels.find(l => l.id === id);
        if (!level) return;

        this.state.currentLevelId = id;

        // Update List UI
        document.querySelectorAll('.demon-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === id);
        });

        if (scrollToList) {
            const activeEl = document.querySelector(`.demon-item[data-id="${id}"]`);
            if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        // Update Details UI with animation
        this.els.detailView.classList.remove('fade-in');
        void this.els.detailView.offsetWidth; // trigger reflow
        this.els.detailView.classList.add('fade-in');

        // Populate Data
        this.setText('detail-rank', `#${level.rank}`);
        this.setText('detail-name', level.name);
        this.setText('detail-creator', level.creator);
        this.setText('detail-verifier', level.verifier);
        this.setText('detail-id', level.level_id);
        this.setText('detail-points', level.points);
        this.setText('detail-length', level.length);
        this.setText('detail-about', level.about);

        // Image Handling
        const detailImg = document.getElementById('detail-image');
        const highResImg = this.getHighResImage(level);

        detailImg.crossOrigin = "Anonymous";
        detailImg.src = highResImg;

        detailImg.onload = () => {
            this.updateThemeColors(detailImg);
        };

        // Fallback handled by the helper logic mostly, but if even highRes fails (e.g. 404),
        // we might want a final safety net, though getHighResImage returns the best guess.
        detailImg.onerror = () => {
            if (detailImg.src !== level.image) detailImg.src = level.image;
        };

        const ytId = this.getYouTubeId(level.video);
        const thumbImg = document.getElementById('detail-video-thumb');
        thumbImg.src = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : level.image;

        document.getElementById('detail-yt-link').href = level.video;
        document.getElementById('video-click-link').href = level.video;

        // Render basic or cached data first
        this.renderVictors(level.victors);

        // Fetch details if not loaded
        if (level.victors === null) {
            this.fetchLevelDetails(id);
        }
    }

    // Helper to get high res image
    getHighResImage(level) {
        const ytId = this.getYouTubeId(level.video);
        if (ytId) {
            return `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
        }
        return level.image;
    }

    async fetchLevelDetails(id) {
        // Show loading state for victors
        const victorsContainer = document.getElementById('victors-list');
        if (victorsContainer) victorsContainer.innerHTML = '<div class="loader-small"></div>';

        try {
            const response = await fetch(`https://pointercrate.com/api/v2/demons/${id}/`);
            if (!response.ok) throw new Error('Failed to fetch details');
            const data = await response.json();

            // Find level in state
            const levelIndex = this.state.levels.findIndex(l => l.id == id); // Loose equality for string/number mismatch safety
            if (levelIndex !== -1) {
                // Update state
                const records = data.data.records || [];
                // Map records to just names for now to match renderVictors expectation, 
                // or we could enhance renderVictors to take objects.
                // Let's just pass the objects and update renderVictors to handle them for better UX (video links).
                this.state.levels[levelIndex].victors = records;

                // If still selected, re-render
                if (this.state.currentLevelId == id) {
                    this.renderVictors(this.state.levels[levelIndex].victors);
                }
            }
        } catch (error) {
            console.error('Details fetch failed', error);
            const levelIndex = this.state.levels.findIndex(l => l.id == id);
            if (levelIndex !== -1) {
                this.state.levels[levelIndex].victors = []; // Set to empty on error to stop retrying loops if we had one (we don't, but good practice)
                if (this.state.currentLevelId == id) {
                    this.renderVictors([]);
                }
            }
        }
    }

    updateThemeColors(img) {
        try {
            // Get palette (2 colors)
            const palette = this.colorThief.getPalette(img, 2);
            if (palette && palette.length >= 2) {
                const c1 = palette[0];
                const c2 = palette[1];

                const cssCol1 = `rgb(${c1[0]}, ${c1[1]}, ${c1[2]})`;
                const cssCol2 = `rgb(${c2[0]}, ${c2[1]}, ${c2[2]})`;

                document.documentElement.style.setProperty('--bg-accent-1', cssCol1);
                document.documentElement.style.setProperty('--bg-accent-2', cssCol2);

                // Optional: Update primary glow to match dominant color for extra immersion
                document.documentElement.style.setProperty('--primary-glow', `rgba(${c1[0]}, ${c1[1]}, ${c1[2]}, 0.5)`);
            }
        } catch (e) {
            // console.warn('Color extraction failed (likely CORS):', e);
            // Fallback to defaults
            document.documentElement.style.setProperty('--bg-accent-1', '#3b82f6');
            document.documentElement.style.setProperty('--bg-accent-2', '#ec4899');
        }
    }

    renderList() {
        const visible = this.getVisibleLevels();
        this.els.listContainer.innerHTML = visible.map((level, index) => `
            <div class="demon-item slide-in-left p-3 mb-1 rounded-lg flex items-center gap-4 ${level.id === this.state.currentLevelId ? 'active' : ''}" 
                 style="animation-delay: ${index * 30}ms"
                 data-id="${level.id}"
                 onclick="app.selectLevel('${level.id}')">
                <span class="rank-badge w-8 text-center text-lg ${index < 3 ? 'text-yellow-400' : 'text-slate-500'}">#${level.rank}</span>
                <img src="${level.image}" class="w-16 h-10 object-cover rounded shadow-sm opacity-80 hover:opacity-100 transition-opacity" loading="lazy">
                <div class="flex-1 min-w-0 z-10">
                    <h4 class="font-bold text-white truncate text-sm">${level.name}</h4>
                    <p class="text-[10px] text-slate-400 uppercase tracking-wider">${level.creator}</p>
                </div>
                ${this.state.sortBy === 'points' ? `<span class="text-xs font-mono text-blue-400">${level.points}</span>` : ''}
            </div>
        `).join('');
    }

    renderVictors(victors) {
        const container = document.getElementById('victors-list');

        if (victors === null) {
            container.innerHTML = '<p class="text-sm text-slate-500 italic animate-pulse">Loading victors...</p>';
            return;
        }

        if (!victors || victors.length === 0) {
            container.innerHTML = '<p class="text-sm text-slate-500 italic">No victors recorded.</p>';
            return;
        }

        container.innerHTML = victors.map(v => {
            // Handle both string (legacy/fallback) and object (new API) formats
            const name = typeof v === 'string' ? v : v.player.name;
            const videoUrl = typeof v === 'string' ? null : v.video;

            return `
            <div class="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5 hover:border-white/10 transition-colors group">
                <div class="flex items-center gap-2">
                    <span class="text-slate-300 font-medium text-sm">${name}</span>
                    ${videoUrl ? `
                        <a href="${videoUrl}" target="_blank" class="text-blue-400 hover:text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity" title="Watch Video">
                            <span class="material-icons text-[16px]">play_circle</span>
                        </a>
                    ` : ''}
                </div>
                <span class="text-green-400 font-mono text-[10px] bg-green-400/10 px-1.5 py-0.5 rounded">100%</span>
            </div>
        `}).join('');
    }

    renderStats() {
        if (!this.state.levels.length) return;

        // Creators Stats
        const creatorCounts = {};
        this.state.levels.forEach(l => {
            creatorCounts[l.creator] = (creatorCounts[l.creator] || 0) + 1;
        });

        const topCreators = Object.entries(creatorCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        const creatorsContainer = document.getElementById('stats-creators');
        creatorsContainer.innerHTML = topCreators.map(([name, count], i) => `
            <div class="flex justify-between items-center p-2 rounded hover:bg-white/5 transition">
                <div class="flex items-center gap-3">
                    <span class="text-slate-500 font-bold w-6 text-sm">#${i + 1}</span>
                    <span class="text-white font-medium">${name}</span>
                </div>
                <span class="text-blue-400 font-bold text-sm bg-blue-400/10 px-2 py-0.5 rounded">${count} Levels</span>
            </div>
        `).join('');

        // Verifiers Stats
        const verifierCounts = {};
        this.state.levels.forEach(l => {
            verifierCounts[l.verifier] = (verifierCounts[l.verifier] || 0) + 1;
        });

        const topVerifiers = Object.entries(verifierCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        const verifiersContainer = document.getElementById('stats-verifiers');
        verifiersContainer.innerHTML = topVerifiers.map(([name, count], i) => `
            <div class="flex justify-between items-center p-2 rounded hover:bg-white/5 transition">
                <div class="flex items-center gap-3">
                    <span class="text-slate-500 font-bold w-6 text-sm">#${i + 1}</span>
                    <span class="text-white font-medium">${name}</span>
                </div>
                <span class="text-green-400 font-bold text-sm bg-green-400/10 px-2 py-0.5 rounded">${count} Levels</span>
            </div>
        `).join('');
    }

    initRoulette() {
        const spinBtn = document.getElementById('btn-spin');
        const goToBtn = document.getElementById('btn-go-to-level');
        this.els.rouletteCard = document.getElementById('roulette-card');
        this.els.rouletteResult = document.getElementById('roulette-result');
        this.els.rouletteContent = document.getElementById('roulette-content');
        this.state.isSpinning = false; // Initialize spinning state

        spinBtn.addEventListener('click', () => {
            if (this.state.isSpinning) return;
            this.spinRoulette();
        });

        goToBtn.addEventListener('click', () => {
            if (this.state.rouletteLevelId) {
                this.selectLevel(this.state.rouletteLevelId);
                this.switchView('main');
            }
        });
    }

    spinRoulette() {
        this.state.isSpinning = true;
        const spinBtn = document.getElementById('btn-spin');
        spinBtn.classList.add('opacity-50', 'cursor-not-allowed');

        this.els.rouletteContent.classList.add('hidden');
        this.els.rouletteResult.classList.remove('hidden');
        this.els.rouletteCard.classList.remove('roulette-winner');

        const rName = document.getElementById('r-name');
        const rCreator = document.getElementById('r-creator');

        let ticks = 0;
        let speed = 50; // Initial speed (ms)
        const levels = this.state.levels;

        const shuffle = () => {
            // Pick random level
            const random = levels[Math.floor(Math.random() * levels.length)];

            // Visual Update
            rName.textContent = random.name;
            rCreator.textContent = `by ${random.creator}`;
            // Use standard image for shuffle performance, only high-res at end
            this.els.rouletteResult.style.backgroundImage = `url('${random.image}')`;
            this.els.rouletteResult.classList.add('roulette-shuffle'); // Blur effect

            ticks++;

            // Deceleration Logic
            if (ticks > 15) speed += 10;
            if (ticks > 20) speed += 20;
            if (ticks > 25) speed += 50;

            if (ticks < 30) {
                setTimeout(shuffle, speed);
            } else {
                // STOP
                this.finishSpin(random);
            }
        };

        shuffle();
    }

    finishSpin(level) {
        this.state.isSpinning = false;
        const spinBtn = document.getElementById('btn-spin');
        spinBtn.classList.remove('opacity-50', 'cursor-not-allowed');

        this.state.rouletteLevelId = level.id;

        // Final UI Set
        const rName = document.getElementById('r-name');
        const rCreator = document.getElementById('r-creator');

        rName.textContent = level.name;
        rCreator.textContent = `by ${level.creator}`;

        // High Res Image for the Winner!
        const highRes = this.getHighResImage(level);
        this.els.rouletteResult.style.backgroundImage = `url('${highRes}')`;
        this.els.rouletteResult.classList.remove('roulette-shuffle');

        // Winning Animation
        this.els.rouletteCard.classList.add('roulette-winner');

        // Trigger color extraction for immersion?
        // Why not, let's create a temp image to extract color
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = highRes;
        img.onload = () => this.updateThemeColors(img);
    }

    setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    getYouTubeId(url) {
        if (!url) return null;
        if (url.includes('v=')) return url.split('v=')[1]?.split('&')[0];
        return url.split('/').pop();
    }
}

// Global accessor for HTML onclick attributes if needed (though I used addEventListener mostly, the onclick in renderList needs this)
window.app = new DemonListApp();
