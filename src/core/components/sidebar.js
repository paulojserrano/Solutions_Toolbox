export function renderSidebar(containerId, activePageKey) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const links = {
        'engineering': [
            { key: 'tote-pack', label: 'Tote Pack Analysis', href: '#' },
            { key: 'layout', label: 'Layout Tool', href: '/layout-tool.html' },
            { key: 'cpu-tool', label: 'CPU Tool', href: '/cpu-tool.html' }
        ],
        'training': [
            { key: 'sc-101', label: 'Supply Chain 101', href: '/training/supply-chain-101.html' },
            { key: 'ie-101', label: 'IE 101', href: '/training/ie-101.html' },
            { key: 'data-analysis', label: 'Data Analysis', href: '/training/data-analysis.html' }
        ],
        'team': [
            { key: 'process', label: 'Process', href: '/team/process.html' },
            { key: 'contacts', label: 'Contacts', href: '/team/contacts.html' },
            { key: 'resources', label: 'Resources', href: '/team/resources.html' }
        ]
    };

    function renderContent() {
        const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';

        // Classes based on state
        const asideWidth = isCollapsed ? 'w-16' : 'w-64';
        const hideText = isCollapsed ? 'hidden' : 'block';
        const centerItems = isCollapsed ? 'justify-center' : '';
        const pxClass = isCollapsed ? 'px-2' : 'px-3';
        const logoMargin = isCollapsed ? 'mr-0' : 'mr-3';

        const renderLink = (link) => {
            const isActive = link.key === activePageKey;
            const activeClass = isActive ? 'text-white bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.3)] rounded-md border border-blue-500' : 'text-slate-300 hover:text-white hover:bg-white/5 transition-colors';
            const iconColor = isActive ? 'text-white' : 'opacity-50 group-hover:opacity-100 transition-opacity';
            const justifyLink = isCollapsed ? 'justify-center' : '';

            // Tooltip for collapsed state could be added here (title attribute)
            return `
                <a href="${link.href}" title="${isCollapsed ? link.label : ''}" class="flex items-center ${justifyLink} gap-3 px-3 py-2 text-sm font-medium rounded-md group ${activeClass}">
                    <svg class="w-5 h-5 ${iconColor} shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                    <span class="${hideText} whitespace-nowrap overflow-hidden">${link.label}</span>
                </a>
            `;
        };

        const renderSectionHeader = (title) => {
             if (isCollapsed) return `<div class="h-px bg-slate-800 my-2 mx-2"></div>`;
             return `<div class="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest transition-opacity duration-200">${title}</div>`;
        };

        const toggleIcon = isCollapsed
            ? `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>` // Double arrow right
            : `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>`; // Double arrow left

        return `
            <aside class="${asideWidth} bg-[#0f172a] text-slate-300 flex-shrink-0 flex flex-col z-20 shadow-xl h-full transition-all duration-300 ease-in-out">
                <div class="h-14 flex items-center px-4 border-b border-slate-800/50 bg-[#0f172a] ${centerItems} overflow-hidden">
                    <div class="w-8 h-8 rounded bg-blue-600 ${logoMargin} flex items-center justify-center shrink-0"><span class="text-white font-bold text-sm">E</span></div>
                    <h1 class="text-white font-bold tracking-wide text-sm ${hideText} whitespace-nowrap">ENG Toolbox</h1>
                </div>
                <nav class="flex-1 overflow-y-auto py-6 ${pxClass} space-y-6 custom-scrollbar overflow-x-hidden">
                    <div>
                        ${renderSectionHeader('Overview')}
                        <a href="/index.html" title="${isCollapsed ? 'Dashboard' : ''}" class="flex items-center ${centerItems} gap-3 px-3 py-2 text-sm font-medium rounded-md hover:text-white hover:bg-white/5 transition-colors group ${activePageKey === 'dashboard' ? 'bg-white/10 text-white' : ''}">
                                <svg class="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
                            <span class="${hideText}">Dashboard</span>
                        </a>
                    </div>
                    <div>
                        ${renderSectionHeader('Engineering Tools')}
                        <div class="space-y-0.5">
                            ${links.engineering.map(renderLink).join('')}
                        </div>
                    </div>
                        <div>
                        ${renderSectionHeader('Training')}
                        <div class="space-y-0.5">
                            ${links.training.map(renderLink).join('')}
                        </div>
                    </div>
                        <div>
                        ${renderSectionHeader('Team')}
                        <div class="space-y-0.5">
                            ${links.team.map(renderLink).join('')}
                        </div>
                    </div>
                </nav>
                <div class="p-4 border-t border-slate-800/50 flex ${centerItems}">
                    <button id="sidebar-toggle-btn" class="p-2 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                        ${toggleIcon}
                    </button>
                </div>
            </aside>
        `;
    }

    // Initial Render
    container.innerHTML = renderContent();

    // Re-bind events helper
    function bindEvents() {
        const toggleBtn = container.querySelector('#sidebar-toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const current = localStorage.getItem('sidebarCollapsed') === 'true';
                localStorage.setItem('sidebarCollapsed', !current);
                container.innerHTML = renderContent();
                bindEvents(); // Re-bind after replacing HTML
            });
        }
    }

    bindEvents();
}
