(function () {
    'use strict';

    const state = {
        currentToken: '',
        currentApiVersion: '',
        displayedScheduleData: [],
        printAssets: new Map(),
        extensionUrls: new Map(),
        extensionUrlRequestId: 0
    };

    function saveToken(token) {
        if (token && typeof token === 'string' && token.length > 20) {
            state.currentToken = token;
            sessionStorage.setItem('ed_live_token', token);
        }
    }

    function captureApiVersion(url) {
        if (!url) return;
        try {
            const parsedUrl = new URL(url, window.location.href);
            if (parsedUrl.hostname.toLowerCase() !== 'api.ecoledirecte.com'
                || !parsedUrl.pathname.toLowerCase().includes('/v3/')) return;
            const version = parsedUrl.searchParams.get('v');
            if (version) {
                state.currentApiVersion = version;
                sessionStorage.setItem('ed_api_version', version);
            }
        } catch (error) {}
    }

    function captureDisplayedSchedule(url, responseData) {
        if (!String(url || '').toLowerCase().includes('emploidutemps.awp')) return;
        const events = responseData && Array.isArray(responseData.data) ? responseData.data : null;
        if (!events || events.length === 0) return;
        const mergedEvents = new Map();
        [...state.displayedScheduleData, ...events].forEach(event => {
            const key = `${event.id || ''}-${event.start_date || ''}-${event.end_date || ''}`;
            mergedEvents.set(key, event);
        });
        state.displayedScheduleData = [...mergedEvents.values()];
    }

    function getToken() {
        if (state.currentToken) return state.currentToken;
        const stored = sessionStorage.getItem('ed_live_token');
        if (stored) return stored;
        for (const key of ['token', 'x-token', 'X-Token']) {
            const value = sessionStorage.getItem(key) || localStorage.getItem(key);
            if (value) return value.replace(/^"|"$/g, '');
        }
        return '';
    }

    function getApiVersion() {
        return state.currentApiVersion || sessionStorage.getItem('ed_api_version') || '4.101.4';
    }

    function getEleveId() {
        const match = window.location.pathname.match(/\/E\/(\d+)/i);
        if (match && match[1]) return match[1];
        try {
            const rawUser = sessionStorage.getItem('user') || localStorage.getItem('user');
            if (!rawUser) return null;
            const user = JSON.parse(rawUser);
            if (user.typeCompte === 'E') return user.id;
            if (user.comptes && user.comptes[0]) return user.comptes[0].id;
            return user.id;
        } catch (error) {
            return null;
        }
    }

    async function apiRequest(endpoint, query = {}, payload = {}) {
        const token = getToken();
        if (!token) throw new Error('Jeton toujours introuvable. Naviguez brièvement dans le menu ou appuyez sur F5.');
        const queryParams = new URLSearchParams({ verbe: 'get', ...query });
        const bodyData = new URLSearchParams();
        bodyData.append('data', JSON.stringify(payload));
        const response = await fetch(`https://api.ecoledirecte.com/v3/${endpoint}?${queryParams}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Token': token },
            body: bodyData.toString()
        });
        return response.json();
    }

    function decodeBase64Utf8(value) {
        if (!value) return '';
        try {
            const binary = atob(value);
            return new TextDecoder('utf-8').decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
        } catch (error) {
            try { return atob(value); } catch (fallbackError) { return value; }
        }
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function formatDateFrench(dateStr) {
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    }

    function getExtensionUrl(path) {
        if (state.extensionUrls.has(path)) return state.extensionUrls.get(path);
        const requestId = `ed-print-${++state.extensionUrlRequestId}`;
        const request = new Promise((resolve, reject) => {
            const timeout = window.setTimeout(() => {
                window.removeEventListener('message', onMessage);
                reject(new Error(`Impossible de charger les ressources d’impression (${path}).`));
            }, 5000);
            function onMessage(event) {
                const response = event.data;
                if (event.source !== window || !response || response.source !== 'ed-print-bridge'
                    || response.type !== 'url-response' || response.id !== requestId) return;
                window.clearTimeout(timeout);
                window.removeEventListener('message', onMessage);
                state.extensionUrls.set(path, response.url);
                resolve(response.url);
            }
            window.addEventListener('message', onMessage);
            window.postMessage({ source: 'ed-print-main', type: 'get-url', id: requestId, path }, '*');
        });
        state.extensionUrls.set(path, request);
        return request;
    }

    async function loadPrintAsset(path) {
        if (!state.printAssets.has(path)) {
            state.printAssets.set(path, getExtensionUrl(path).then(url => fetch(url)).then(response => {
                if (!response.ok) throw new Error(`Impossible de charger ${path}.`);
                return response.text();
            }));
        }
        return state.printAssets.get(path);
    }

    async function openReactPrintWindow(type, data, stylesPath) {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return alert("Autorise les fenêtres pop-up sur ce site pour lancer l'impression.");
        try {
            const [template, stylesUrl, scriptUrl] = await Promise.all([
                loadPrintAsset('assets/templates/print.html'),
                getExtensionUrl(stylesPath),
                getExtensionUrl('dist/print.js')
            ]);
            const serializedData = JSON.stringify({ type, data }).replace(/</g, '\\u003c');
            printWindow.document.open();
            printWindow.document.write(template.replace('{{stylesUrl}}', stylesUrl).replace('{{scriptUrl}}', scriptUrl).replace('{{data}}', serializedData));
            printWindow.document.close();
        } catch (error) {
            printWindow.close();
            console.error('[EDPrint] Échec du chargement de la vue React d’impression.', { type, stylesPath, error });
            throw error;
        }
    }

    window.EDPrint = {
        state,
        saveToken,
        captureApiVersion,
        captureDisplayedSchedule,
        getToken,
        getApiVersion,
        getEleveId,
        apiRequest,
        decodeBase64Utf8,
        escapeHtml,
        formatDateFrench,
        loadPrintAsset,
        openReactPrintWindow
    };
}());