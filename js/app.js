// Data is loaded globally from data.js

class DemonListApp {
    constructor() {
        this.state = {
            levels: [...window.demons],
            currentLevelId: null,
            filter: '',
            sortBy: 'rank', // 'rank' | 'points'
            focusedIndex: 0
        };

        this.els = {
            listContainer: document.getElementById('demon-list-container'),
            searchInput: document.getElementById('search-input'),
            detailView: document.getElementById('level-detail-view'),
            btnSort: document.getElementById('btn-sort'),
            btnRandom: document.getElementById('btn-random')
        };

        this.init();
    }

    init() {
        this.renderList();
        this.selectLevel(this.state.levels[0].id);
        this.setupEventListeners();
        this.setupKeyboardNav();
    }

    setupEventListeners() {
        // Search
        this.els.searchInput.addEventListener('input', (e) => {
            this.state.filter = e.target.value.toLowerCase();
            this.state.focusedIndex = 0;
            this.renderList();
        });

        // Sorting
        this.els.btnSort.addEventListener('click', () => {
            if (this.state.sortBy === 'rank') {
                this.state.sortBy = 'points';
                this.els.btnSort.innerHTML = '<span class="material-icons">trending_down</span> Points';
                this.state.levels.sort((a, b) => parseFloat(b.points) - parseFloat(a.points));
            } else {
                this.state.sortBy = 'rank';
                this.els.btnSort.innerHTML = '<span class="material-icons">format_list_numbered</span> Rank';
                this.state.levels.sort((a, b) => a.rank - b.rank);
            }
            this.renderList();
            this.selectLevel(this.state.levels[0].id);
        });

        // Random
        this.els.btnRandom.addEventListener('click', () => {
            const randomIndex = Math.floor(Math.random() * this.state.levels.length);
            const randomLevel = this.state.levels[randomIndex];
            this.selectLevel(randomLevel.id);
            // Scroll to it in list
            const listItem = document.querySelector(`[data-id="${randomLevel.id}"]`);
            if (listItem) listItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }

    setupKeyboardNav() {
        document.addEventListener('keydown', (e) => {
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
        this.setText('detail-id', level.id);
        this.setText('detail-points', level.points);
        this.setText('detail-length', level.length);
        this.setText('detail-about', level.about);

        document.getElementById('detail-image').src = level.image;
        document.getElementById('detail-video-thumb').src = `https://i.ytimg.com/vi/${this.getYouTubeId(level.video)}/maxresdefault.jpg`;
        document.getElementById('detail-yt-link').href = level.video;
        document.getElementById('video-click-link').href = level.video;

        this.renderVictors(level.victors);
    }

    renderList() {
        const visible = this.getVisibleLevels();
        this.els.listContainer.innerHTML = visible.map((level, index) => `
            <div class="demon-item p-3 mb-1 rounded-lg flex items-center gap-4 ${level.id === this.state.currentLevelId ? 'active' : ''}" 
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
        if (!victors || victors.length === 0) {
            container.innerHTML = '<p class="text-sm text-slate-500 italic">No victors recorded.</p>';
            return;
        }
        container.innerHTML = victors.map(v => `
            <div class="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                <span class="text-slate-300 font-medium text-sm">${v}</span>
                <span class="text-green-400 font-mono text-[10px] bg-green-400/10 px-1.5 py-0.5 rounded">100%</span>
            </div>
        `).join('');
    }

    setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    getYouTubeId(url) {
        if (url.includes('v=')) return url.split('v=')[1]?.split('&')[0];
        return url.split('/').pop();
    }
}

// Global accessor for HTML onclick attributes if needed (though I used addEventListener mostly, the onclick in renderList needs this)
window.app = new DemonListApp();
