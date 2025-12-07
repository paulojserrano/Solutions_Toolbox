export function renderSidebar(containerId, activePageKey) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const links = {
        'engineering': [
            { key: 'tote-pack', label: 'Tote Pack Analysis', href: '#' }, // Placeholder
            { key: 'layout', label: 'Layout Tool', href: '/layout-tool.html' }
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

    const renderLink = (link) => {
        const isActive = link.key === activePageKey;
        const activeClass = isActive ? 'text-white bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.3)] rounded-md border border-blue-500' : 'text-slate-300 hover:text-white hover:bg-white/5 transition-colors';
        const iconColor = isActive ? 'text-white' : 'opacity-50 group-hover:opacity-100 transition-opacity';

        // Simplified icon for now
        return `
            <a href="${link.href}" class="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md group ${activeClass}">
                <svg class="w-5 h-5 ${iconColor}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                ${link.label}
            </a>
        `;
    };

    container.innerHTML = `
        <aside class="w-64 bg-[#0f172a] text-slate-300 flex-shrink-0 flex flex-col z-20 shadow-xl h-full">
            <div class="h-14 flex items-center px-5 border-b border-slate-800/50 bg-[#0f172a]">
                <div class="w-6 h-6 rounded bg-blue-600 mr-3 flex items-center justify-center"><span class="text-white font-bold text-xs">E</span></div>
                <h1 class="text-white font-bold tracking-wide text-sm">ENG Toolbox</h1>
            </div>
            <nav class="flex-1 overflow-y-auto py-6 px-3 space-y-6">
                <div>
                    <div class="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Overview</div>
                    <a href="/index.html" class="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:text-white hover:bg-white/5 transition-colors group ${activePageKey === 'dashboard' ? 'bg-white/10 text-white' : ''}">
                            <svg class="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
                        Dashboard
                    </a>
                </div>
                <div>
                    <div class="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Engineering Tools</div>
                    <div class="space-y-0.5">
                        ${links.engineering.map(renderLink).join('')}
                    </div>
                </div>
                    <div>
                    <div class="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Training</div>
                    <div class="space-y-0.5">
                        ${links.training.map(renderLink).join('')}
                    </div>
                </div>
                    <div>
                    <div class="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Team</div>
                    <div class="space-y-0.5">
                        ${links.team.map(renderLink).join('')}
                    </div>
                </div>
            </nav>
        </aside>
    `;
}
