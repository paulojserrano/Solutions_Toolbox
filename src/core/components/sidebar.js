export function renderSidebar(containerId, activePageKey) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const links = {
        'engineering': [
            { key: 'layout', label: 'Layout Tool', href: '/layout-tool.html' },
            { key: 'cpu-tool', label: 'CPU Tool', href: '/cpu-tool.html' },
            { key: 'most-calculator', label: 'MOST Calculator', href: '/most-calculator.html' },
            { key: 'simple-packer', label: 'Simple Packer', href: '/simple-packer.html' }
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

    // Icons Map
    const icons = {
        'layout': 'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z', // Grid
        'cpu-tool': 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z', // Calculator
        'most-calculator': 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', // Clock
        'simple-packer': 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', // Box
        'sc-101': 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4', // Package
        'ie-101': 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', // Cog
        'data-analysis': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', // Chart
        'process': 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', // Refresh
        'contacts': 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', // Users
        'resources': 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' // Book
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
            const iconPath = icons[link.key] || 'M13 10V3L4 14h7v7l9-11h-7z'; // Default

            // Tooltip for collapsed state could be added here (title attribute)
            return `
                <a href="${link.href}" title="${isCollapsed ? link.label : ''}" class="flex items-center ${justifyLink} gap-3 px-3 py-2 text-sm font-medium rounded-md group ${activeClass}">
                    <svg class="w-5 h-5 ${iconColor} shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPath}"/></svg>
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
