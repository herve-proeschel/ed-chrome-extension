(function () {
    'use strict';

    let currentToken = '';

    function saveToken(token) {
        if (token && typeof token === 'string' && token.length > 20) {
            currentToken = token;
            sessionStorage.setItem('ed_live_token', token);
        }
    }

    // Interception Fetch
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        // Capture du token dans les headers envoyés
        try {
            if (args[1] && args[1].headers) {
                const h = args[1].headers;
                const reqToken = h['X-Token'] || (h.get && h.get('X-Token'));
                if (reqToken) saveToken(reqToken);
            }
        } catch (e) {}

        const response = await originalFetch.apply(this, args);

        // Capture du token dans les headers de réponse
        try {
            const respToken = response.headers.get('x-token');
            if (respToken) saveToken(respToken);
        } catch (e) {}

        return response;
    };

    // Interception XMLHttpRequest (Angular/Axios selon les versions)
    const originalXHRSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
        if (header && header.toLowerCase() === 'x-token') {
            saveToken(value);
        }
        return originalXHRSetHeader.apply(this, arguments);
    };

    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function () {
        this.addEventListener('load', () => {
            try {
                const respToken = this.getResponseHeader('x-token');
                if (respToken) saveToken(respToken);
            } catch (e) {}
        });
        return originalXHROpen.apply(this, arguments);
    };

    function getToken() {
        if (currentToken) return currentToken;
        const stored = sessionStorage.getItem('ed_live_token');
        if (stored) return stored;

        // Fallbacks au cas où
        const keys = ['token', 'x-token', 'X-Token'];
        for (const k of keys) {
            const val = sessionStorage.getItem(k) || localStorage.getItem(k);
            if (val) return val.replace(/^"|"$/g, '');
        }
        return '';
    }

    function getEleveId() {
        const match = window.location.pathname.match(/\/E\/(\d+)/i);
        if (match && match[1]) return match[1];

        try {
            const rawUser = sessionStorage.getItem('user') || localStorage.getItem('user');
            if (rawUser) {
                const u = JSON.parse(rawUser);
                if (u.typeCompte === 'E') return u.id;
                if (u.comptes && u.comptes[0]) return u.comptes[0].id;
                return u.id;
            }
        } catch (e) {}
        return null;
    }

    function decodeBase64Utf8(str) {
        if (!str) return '';
        try {
            const binary = atob(str);
            const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
            return new TextDecoder('utf-8').decode(bytes);
        } catch (e) {
            try {
                return atob(str);
            } catch (err) {
                return str;
            }
        }
    }

    async function apiRequest(endpoint) {
        const token = getToken();
        if (!token) {
            throw new Error("Jeton toujours introuvable. Naviguez brièvement dans le menu ou appuyez sur F5.");
        }

        const url = `https://api.ecoledirecte.com/v3/${endpoint}?verbe=get`;
        const bodyData = new URLSearchParams();
        bodyData.append('data', '{}');

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Token': token
            },
            body: bodyData.toString()
        });

        const refreshedToken = response.headers.get('x-token');
        if (refreshedToken) {
            saveToken(refreshedToken);
        }

        return await response.json();
    }

    function formatDateFrench(dateStr) {
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    async function collectFutureHomework(btn) {
        const eleveId = getEleveId();
        if (!eleveId) {
            alert("Identifiant élève introuvable.");
            return;
        }

        const setButtonLabel = (label) => {
            const labelElement = btn.querySelector('.ed-print-label');
            if (labelElement) labelElement.textContent = label;
        };

        btn.disabled = true;
        setButtonLabel("Récupération du planning...");

        try {
            const listRes = await apiRequest(`Eleves/${eleveId}/cahierdetexte.awp`);
            if (!listRes || listRes.code !== 200 || !listRes.data) {
                throw new Error(listRes.message || "Erreur de réponse de l'API.");
            }

            const todayStr = new Date().toISOString().split('T')[0];
            const futureDates = Object.keys(listRes.data)
                .filter(d => d > todayStr)
                .sort();

            if (futureDates.length === 0) {
                alert("Aucun devoir trouvé pour les jours suivants.");
                return;
            }

            const detailedDays = [];
            for (let i = 0; i < futureDates.length; i++) {
                const date = futureDates[i];
                setButtonLabel(`Collecte (${i + 1}/${futureDates.length}) : ${date}...`);

                const dayDetail = await apiRequest(`Eleves/${eleveId}/cahierdetexte/${date}.awp`);
                if (dayDetail && dayDetail.code === 200 && dayDetail.data) {
                    detailedDays.push(dayDetail.data);
                }
            }

            setButtonLabel("Préparation du document...");
            openPrintWindow(detailedDays);

        } catch (err) {
            console.error(err);
            alert(`Erreur : ${err.message}`);
        } finally {
            btn.disabled = false;
            setButtonLabel("Imprimer les devoirs");
        }
    }

    function openPrintWindow(daysData) {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert("Autorise les fenêtres pop-up sur ce site pour lancer l'impression.");
            return;
        }

        let contentHtml = '';

        daysData.forEach(day => {
            const dateTitle = formatDateFrench(day.date);
            contentHtml += `
                <div class="day-container">
                    <h2 class="day-title">${dateTitle.toUpperCase()}</h2>
            `;

            const matieres = day.matieres || [];
            let homeworkFound = false;

            matieres.forEach(m => {
                const aFaire = m.aFaire;
                if (!aFaire && (!m.contenuDeSeance || !m.contenuDeSeance.contenu)) return;

                homeworkFound = true;
                const nomMatiere = m.matiere || 'Matière';
                const detailsRaw = aFaire ? aFaire.contenu : '';
                const detailsHtml = decodeBase64Utf8(detailsRaw);
                const renduDate = aFaire && aFaire.donneLe ? `(Donné le ${formatDateFrench(aFaire.donneLe)})` : '';
                const interrogation = aFaire && aFaire.interrogation ? '<span class="badge-eval">Évaluation / Contrôle</span>' : '';

                contentHtml += `
                    <div class="subject-box">
                        <div class="subject-header">
                            <span class="subject-title">${nomMatiere}</span>
                            <span class="subject-meta">${renduDate} ${interrogation}</span>
                        </div>
                        <div class="subject-content">
                            ${detailsHtml || '<em>Aucun détail fourni</em>'}
                        </div>
                    </div>
                `;
            });

            if (!homeworkFound) {
                contentHtml += `<p class="no-hw">Aucun travail spécifique à faire enregistré.</p>`;
            }

            contentHtml += `</div>`;
        });

        const htmlDocument = `
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <title>Cahier de texte - Devoirs à venir</title>
                <style>
                    body { font-family: Arial, sans-serif; color: #222; margin: 20px; line-height: 1.4; }
                    .day-container { margin-bottom: 24px; page-break-inside: avoid; }
                    .day-title { font-size: 1.2rem; background-color: #0b4e84; color: white; padding: 6px 12px; border-radius: 4px; margin-bottom: 10px; }
                    .subject-box { border: 1px solid #ccc; border-left: 5px solid #0b4e84; margin-bottom: 8px; padding: 8px 12px; page-break-inside: avoid; }
                    .subject-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; border-bottom: 1px dashed #eee; padding-bottom: 4px; }
                    .subject-title { font-weight: bold; color: #0b4e84; }
                    .subject-meta { font-size: 0.85rem; color: #666; }
                    .badge-eval { background: #dc3545; color: white; padding: 2px 5px; border-radius: 3px; font-weight: bold; font-size: 0.75rem; margin-left: 6px; }
                    .subject-content { font-size: 0.95rem; }
                    .subject-content p { margin: 4px 0; }
                    .no-hw { font-style: italic; color: #777; }
                    @media print {
                        body { margin: 0; }
                        .day-title { background-color: #eee !important; color: #000 !important; border: 1px solid #999; }
                        .subject-box { border-left-color: #333 !important; }
                    }
                </style>
            </head>
            <body>
                <h1 style="text-align: center; margin-bottom: 20px;">Travail à faire (Jours à venir)</h1>
                ${contentHtml}
                <script>
                    window.onload = function() {
                        window.focus();
                        window.print();
                    };
                </script>
            </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(htmlDocument);
        printWindow.document.close();
    }

    function injectButton() {
        if (document.getElementById('ed-custom-print-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'ed-custom-print-btn';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Imprimer les devoirs à venir');
        btn.title = 'Imprimer les devoirs à venir';
        btn.innerHTML = `
            <span class="ed-print-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/>
                    <path d="M7 14h10v7H7zM18 12h.01"/>
                </svg>
            </span>
            <span class="ed-print-label">Imprimer les devoirs</span>
        `;
        btn.style.position = 'fixed';
        btn.style.bottom = '24px';
        btn.style.right = '24px';
        btn.style.zIndex = '2147483647';
        btn.style.display = 'inline-flex';
        btn.style.alignItems = 'center';
        btn.style.gap = '10px';
        btn.style.padding = '13px 18px';
        btn.style.background = 'linear-gradient(135deg, #0b4e84, #176da8)';
        btn.style.color = '#ffffff';
        btn.style.border = '1px solid rgba(255,255,255,0.72)';
        btn.style.borderRadius = '12px';
        btn.style.boxShadow = '0 10px 24px rgba(5, 35, 61, 0.28), 0 2px 5px rgba(0,0,0,0.18)';
        btn.style.cursor = 'pointer';
        btn.style.font = '600 14px/1.2 system-ui, -apple-system, sans-serif';
        btn.style.letterSpacing = '0.01em';
        btn.style.transition = 'transform 160ms ease, box-shadow 160ms ease, filter 160ms ease';

        const style = document.createElement('style');
        style.textContent = `
            #ed-custom-print-btn .ed-print-icon { display: inline-flex; width: 20px; height: 20px; }
            #ed-custom-print-btn svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
            #ed-custom-print-btn:hover { filter: brightness(1.08); transform: translateY(-2px); box-shadow: 0 14px 28px rgba(5, 35, 61, 0.32), 0 3px 7px rgba(0,0,0,0.18); }
            #ed-custom-print-btn:focus-visible { outline: 3px solid #f4c542; outline-offset: 3px; }
            #ed-custom-print-btn:active { transform: translateY(0); }
            #ed-custom-print-btn:disabled { cursor: wait; filter: saturate(.65); opacity: .9; transform: none; }
            @media (max-width: 520px) {
                #ed-custom-print-btn { bottom: 14px !important; right: 14px !important; padding: 12px 14px !important; }
                #ed-custom-print-btn .ed-print-label { display: none; }
            }
        `;
        document.head.appendChild(style);

        btn.addEventListener('click', () => collectFutureHomework(btn));

        document.body.appendChild(btn);
    }

    function checkUrlAndInject() {
        const urlLower = window.location.href.toLowerCase();
        if (urlLower.includes('cahierdetexte') || urlLower.includes('cahier-de-texte') || urlLower.includes('travail-a-faire')) {
            injectButton();
        } else {
            const existingBtn = document.getElementById('ed-custom-print-btn');
            if (existingBtn) existingBtn.remove();
        }
    }

    const observer = new MutationObserver(checkUrlAndInject);
    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    checkUrlAndInject();
})();