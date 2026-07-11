/**
 * ============================================
 * PAGINADOR REUTILIZABLE - DOMIDELIS
 * ============================================
 */
class Paginator {
    constructor(options) {
        this.items = options.items || [];
        this.itemsPerPage = options.itemsPerPage || 12;
        this.containerId = options.containerId;
        this.renderCallback = options.renderCallback;
        this.onPageChange = options.onPageChange || null; // ★ NUEVO: Callback al cambiar de página
        this.currentPage = 1;
        this.totalPages = Math.ceil(this.items.length / this.itemsPerPage) || 1;

        this.init();
    }

    init() {
        this.renderPagination();
        this.goToPage(1);
    }

    getCurrentPageItems() {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        return this.items.slice(start, end);
    }

    goToPage(page) {
        if (page < 1 || page > this.totalPages) return;

        this.currentPage = page;
        const currentItems = this.getCurrentPageItems();

        if (typeof this.renderCallback === 'function') {
            this.renderCallback(currentItems);
        }

        this.updateActiveButton();
        
        // ★ NUEVO: Ejecutar la función de scroll si está definida
        if (typeof this.onPageChange === 'function') {
            this.onPageChange();
        }
    }

    renderPagination() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="paginador">
                <button class="btn-paginador" id="btn-prev-${this.containerId}">
                    <i class="fas fa-chevron-left"></i> Anterior
                </button>

                <div class="paginas" id="paginas-${this.containerId}"></div>

                <button class="btn-paginador" id="btn-next-${this.containerId}">
                    Siguiente <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;

        document.getElementById(`btn-prev-${this.containerId}`).onclick = () => this.goToPage(this.currentPage - 1);
        document.getElementById(`btn-next-${this.containerId}`).onclick = () => this.goToPage(this.currentPage + 1);

        this.renderPageNumbers();
    }

    renderPageNumbers() {
        const container = document.getElementById(`paginas-${this.containerId}`);
        if (!container) return;

        container.innerHTML = '';

        const maxVisible = 10;
        let startPage = Math.max(1, this.currentPage - 2);
        let endPage = Math.min(this.totalPages, startPage + maxVisible - 1);

        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        if (startPage > 1) {
            this.createPageButton(container, 1);
            if (startPage > 2) this.createEllipsis(container);
        }

        for (let i = startPage; i <= endPage; i++) {
            this.createPageButton(container, i);
        }

        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) this.createEllipsis(container);
            this.createPageButton(container, this.totalPages);
        }
    }

    createPageButton(container, page) {
        const btn = document.createElement('button');
        btn.className = `btn-pagina ${page === this.currentPage ? 'active' : ''}`;
        btn.textContent = page;
        btn.onclick = () => {
            this.goToPage(page);
            this.renderPageNumbers();
        };
        container.appendChild(btn);
    }

    createEllipsis(container) {
        const span = document.createElement('span');
        span.className = 'paginador-ellipsis';
        span.textContent = '...';
        container.appendChild(span);
    }

    updateActiveButton() {
        const container = document.getElementById(`paginas-${this.containerId}`);
        if (!container) return;

        container.querySelectorAll('.btn-pagina').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.textContent) === this.currentPage);
        });
    }

    updateItems(newItems) {
        this.items = newItems;
        this.totalPages = Math.ceil(this.items.length / this.itemsPerPage) || 1;
        this.currentPage = 1;
        this.renderPageNumbers();
        this.goToPage(1);
    }

    destroy() {
        const container = document.getElementById(this.containerId);
        if (container) container.innerHTML = '';
    }
}