import {
    btnFetchSharePoint,
    sharepointStatus,
    sharepointTableBody,
    sharepointRawOutput
} from './dom.js';

// Graph API Construction
const SITE_HOST = 'hairoboticshq.sharepoint.com';
const SITE_PATH = 'sites/USInternalToolDev';
const LIST_NAME = 'Master_Cost_Table';

// Constructed URL for Graph API
// https://graph.microsoft.com/v1.0/sites/{hostname}:/{server-relative-path}:/lists/{list-name}/items
const GRAPH_ENDPOINT = `https://graph.microsoft.com/v1.0/sites/${SITE_HOST}:/${SITE_PATH}:/lists/${LIST_NAME}/items?expand=fields&$top=5`;

async function fetchSharePointList() {
    if (!btnFetchSharePoint) return;

    btnFetchSharePoint.disabled = true;
    sharepointStatus.textContent = "Fetching...";
    sharepointStatus.className = "flex items-center text-sm font-bold font-mono text-blue-600";
    sharepointTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Loading...</td></tr>';
    sharepointRawOutput.textContent = '';

    try {
        // 1. Attempt to get Token from SWA
        // Note: In a standard SWA, /.auth/me only returns ID tokens. 
        // Access tokens for Graph usually require a backend function or specific configuration.
        const authResponse = await fetch('/.auth/me');
        const authPayload = await authResponse.json();
        const token = authPayload.clientPrincipal ? authPayload.clientPrincipal.accessToken : null;

        // Debug log regarding token
        console.log("Auth Payload:", authPayload);

        // Headers
        const headers = {
            'Accept': 'application/json'
        };

        // If we managed to find a token (e.g. custom proxy or config), use it.
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        } else {
            console.warn("No access token found in clientPrincipal. Request might fail with 401.");
        }

        // 2. Call Graph API
        const response = await fetch(GRAPH_ENDPOINT, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // 3. Render Data
        sharepointRawOutput.textContent = JSON.stringify(data, null, 2);
        
        if (data.value && data.value.length > 0) {
            sharepointTableBody.innerHTML = data.value.map(item => {
                const fields = item.fields || {};
                return `
                    <tr>
                        <td>${fields.id || item.id}</td>
                        <td>${fields.Title || 'N/A'}</td>
                        <td>${fields.Created || 'N/A'}</td>
                        <td class="text-xs truncate max-w-[200px]">${JSON.stringify(fields)}</td>
                    </tr>
                `;
            }).join('');
        } else {
            sharepointTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">No items found or empty list.</td></tr>';
        }

        sharepointStatus.textContent = "Success";
        sharepointStatus.className = "flex items-center text-sm font-bold font-mono text-green-600";

    } catch (error) {
        console.error("SharePoint Fetch Error:", error);
        sharepointStatus.textContent = "Failed";
        sharepointStatus.className = "flex items-center text-sm font-bold font-mono text-red-600";
        
        sharepointTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center p-4 text-red-600">
                    <strong>Error:</strong> ${error.message}<br>
                    <span class="text-xs text-black block mt-2">Note: Ensure you are logged in and have permissions to access this Graph endpoint.</span>
                </td>
            </tr>
        `;
        sharepointRawOutput.textContent = error.stack || error.toString();
    } finally {
        btnFetchSharePoint.disabled = false;
    }
}

export function initializeSharePoint() {
    if (btnFetchSharePoint) {
        btnFetchSharePoint.addEventListener('click', fetchSharePointList);
    }
}