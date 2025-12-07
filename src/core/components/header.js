export async function renderHeader(containerId, pageTitle, customHtml = '') {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
        <header class="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10 shrink-0 w-full">
            <div class="flex items-center gap-4">
                 <a href="/index.html" class="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <div class="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-xs">E</div>
                 </a>
                <h2 class="text-lg font-bold text-slate-800 tracking-tight">${pageTitle}</h2>
                <div class="h-4 w-px bg-slate-200"></div>
                ${customHtml}
            </div>
            <div class="flex items-center gap-3">
                 <div id="headerUserProfileContainer" class="flex items-center gap-3 hidden">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-lg">U</div>
                    <div class="flex-1 min-w-0">
                        <p id="userProfileName" class="text-sm font-medium text-slate-700 truncate">Guest User</p>
                        <a href="/.auth/logout" class="text-xs text-slate-500 hover:text-blue-400 transition-colors">Log out</a>
                    </div>
                </div>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wide">v2.3.0</span>
            </div>
        </header>
    `;

    // Auth Logic
    const userProfileName = document.getElementById('userProfileName');
    const userProfileContainer = document.getElementById('headerUserProfileContainer');

    if (userProfileName && userProfileContainer) {
            try {
            const response = await fetch('/.auth/me');
            if (response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const payload = await response.json();
                    const { clientPrincipal } = payload;
                    if (clientPrincipal) {
                        userProfileName.textContent = clientPrincipal.userDetails || clientPrincipal.userId;
                        userProfileContainer.classList.remove('hidden');
                        userProfileContainer.classList.add('flex');
                        return;
                    }
                }
            }
             // Default Guest
             userProfileContainer.classList.remove('hidden');
             userProfileContainer.classList.add('flex');
        } catch (error) {
            console.error("Auth check failed", error);
            userProfileContainer.classList.remove('hidden');
            userProfileContainer.classList.add('flex');
        }
    }
}
