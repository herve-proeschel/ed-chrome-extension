(function () {
    'use strict';

    let currentToken = '';
    let currentApiVersion = '';
    let displayedScheduleData = [];

    function captureDisplayedSchedule(url, responseData) {
        if (!String(url || '').toLowerCase().includes('emploidutemps.awp')) return;
        const events = responseData && Array.isArray(responseData.data) ? responseData.data : null;
        if (!events || events.length === 0) return;

        const mergedEvents = new Map();
        [...displayedScheduleData, ...events].forEach(event => {
            const key = `${event.id || ''}-${event.start_date || ''}-${event.end_date || ''}`;
            mergedEvents.set(key, event);
        });
        displayedScheduleData = [...mergedEvents.values()];
    }

    function saveToken(token) {
        if (token && typeof token === 'string' && token.length > 20) {
            currentToken = token;
            sessionStorage.setItem('ed_live_token', token);
        }
    }

    function captureApiVersion(url) {
        if (!url) return;
        try {
            const parsedUrl = new URL(url, window.location.href);
            const isBackendRequest = parsedUrl.hostname.toLowerCase() === 'api.ecoledirecte.com'
                && parsedUrl.pathname.toLowerCase().includes('/v3/');
            if (!isBackendRequest) return;
            const version = parsedUrl.searchParams.get('v');
            if (version) {
                currentApiVersion = version;
                sessionStorage.setItem('ed_api_version', version);
            }
        } catch (e) {}
    }

    function observeBackendRequests() {
        const captureEntry = entry => captureApiVersion(entry && entry.name);
        try {
            performance.getEntriesByType('resource').forEach(captureEntry);
        } catch (e) {}
        try {
            const observer = new PerformanceObserver(list => {
                list.getEntries().forEach(captureEntry);
            });
            observer.observe({ type: 'resource', buffered: true });
        } catch (e) {}
    }

    // Interception Fetch
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        // Capture du token dans les headers envoyés
        try {
            const requestUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url;
            captureApiVersion(requestUrl);
            if (args[1] && args[1].headers) {
                const h = args[1].headers;
                const reqToken = h['X-Token'] || (h.get && h.get('X-Token'));
                if (reqToken) saveToken(reqToken);
            }
        } catch (e) {}

        const response = await originalFetch.apply(this, args);
        try {
            const requestUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url;
            response.clone().json().then(data => captureDisplayedSchedule(requestUrl, data)).catch(() => {});
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
        this._edRequestUrl = arguments[1];
        captureApiVersion(this._edRequestUrl);
        this.addEventListener('load', () => {
            try {
                const responseData = this.responseType === 'json' ? this.response : JSON.parse(this.responseText);
                captureDisplayedSchedule(this.responseURL || this._edRequestUrl, responseData);
            } catch (e) {}
        });
        return originalXHROpen.apply(this, arguments);
    };

    observeBackendRequests();

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

    function getApiVersion() {
        return currentApiVersion || sessionStorage.getItem('ed_api_version') || '4.101.4';
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

    async function apiRequest(endpoint, query = {}, payload = {}) {
        const token = getToken();
        if (!token) {
            throw new Error("Jeton toujours introuvable. Naviguez brièvement dans le menu ou appuyez sur F5.");
        }

        const queryParams = new URLSearchParams({ verbe: 'get', ...query });
        const url = `https://api.ecoledirecte.com/v3/${endpoint}?${queryParams.toString()}`;
        const bodyData = new URLSearchParams();
        bodyData.append('data', JSON.stringify(payload));

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Token': token
            },
            body: bodyData.toString()
        });

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

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function parseScheduleDate(value) {
        const rawValue = String(value || '').trim();
        const match = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2})(?::(\d{2}))?/);
        if (match) {
            return new Date(
                Number(match[1]),
                Number(match[2]) - 1,
                Number(match[3]),
                Number(match[4]),
                Number(match[5]),
                Number(match[6] || 0)
            );
        }

        const fallbackDate = new Date(rawValue);
        return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate;
    }

    function formatScheduleTime(value) {
        const date = parseScheduleDate(value);
        return date ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
    }

    function formatScheduleDay(date) {
        return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    }

    function startOfWeek(date) {
        const monday = new Date(date);
        const day = monday.getDay() || 7;
        monday.setDate(monday.getDate() - day + 1);
        monday.setHours(0, 0, 0, 0);
        return monday;
    }

    function dateKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function scheduleDateKey(value) {
        const rawValue = String(value || '').trim();
        const key = rawValue.slice(0, 10);
        return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : '';
    }

    function getSchedulePosition(event) {
        const start = parseScheduleDate(event.start_date);
        const end = parseScheduleDate(event.end_date) || start;
        if (!start || !end) return null;

        const dayStart = 8 * 60;
        const dayEnd = 18 * 60;
        const startMinutes = start.getHours() * 60 + start.getMinutes();
        const endMinutes = end.getHours() * 60 + end.getMinutes();
        const visibleStart = Math.max(dayStart, startMinutes);
        const visibleEnd = Math.min(dayEnd, Math.max(visibleStart + 1, endMinutes));
        if (visibleStart >= dayEnd || visibleEnd <= dayStart) return null;

        return {
            top: ((visibleStart - dayStart) / (dayEnd - dayStart)) * 100,
            height: ((visibleEnd - visibleStart) / (dayEnd - dayStart)) * 100
        };
    }

    async function collectSchedule(btn) {
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
        setButtonLabel('Récupération de l’emploi du temps...');

        try {
            const scheduleEndpoint = `E/${eleveId}/emploidutemps.awp`;
            const scheduleQuery = { v: getApiVersion() };
            const weekStart = startOfWeek(new Date());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            const schedulePayload = {
                dateDebut: dateKey(weekStart),
                dateFin: dateKey(weekEnd),
                avecTrous: false
            };
            const scheduleRes = await apiRequest(scheduleEndpoint, scheduleQuery, schedulePayload);
            if (!scheduleRes || scheduleRes.code !== 200 || !Array.isArray(scheduleRes.data)) {
                throw new Error(scheduleRes?.message || "Erreur de réponse de l'API.");
            }

            if (scheduleRes.data.length === 0) {
                alert("Aucun cours trouvé dans l’emploi du temps.");
                return;
            }

            const displayedEvents = displayedScheduleData.length > scheduleRes.data.length
                ? displayedScheduleData
                : scheduleRes.data;
            setButtonLabel('Préparation du document...');
            openSchedulePrintWindow(displayedEvents);
        } catch (err) {
            console.error(err);
            alert(`Erreur : ${err.message}`);
        } finally {
            btn.disabled = false;
            setButtonLabel('Imprimer l’emploi du temps');
        }
    }

    function buildScheduleWeeks(events) {
        const validEvents = events
            .map(event => ({
                ...event,
                parsedStart: parseScheduleDate(event.start_date),
                scheduleDateKey: scheduleDateKey(event.start_date)
            }))
            .filter(event => event.parsedStart && event.scheduleDateKey)
            .sort((a, b) => a.parsedStart - b.parsedStart);
        const weeks = new Map();

        validEvents.forEach(event => {
            const weekStart = startOfWeek(event.parsedStart);
            const key = dateKey(weekStart);
            if (!weeks.has(key)) weeks.set(key, { start: weekStart, events: [] });
            weeks.get(key).events.push(event);
        });

        return [...weeks.values()];
    }

    function renderScheduleWeek(week) {
        const columns = Array.from({ length: 5 }, (_, index) => {
            const day = new Date(week.start);
            day.setDate(day.getDate() + index);
            const key = dateKey(day);
            const dayEvents = week.events
                .filter(event => event.scheduleDateKey === key)
                .map(event => ({ event, position: getSchedulePosition(event) }))
                .filter(item => item.position);
            const overlapGroups = [];
            dayEvents.forEach(item => {
                const start = item.event.parsedStart || parseScheduleDate(item.event.start_date);
                const end = parseScheduleDate(item.event.end_date) || start;
                const matchingGroups = overlapGroups.filter(group => start < group.end);
                if (matchingGroups.length === 0) {
                    overlapGroups.push({ start, end, items: [item] });
                    return;
                }

                const group = matchingGroups[0];
                group.end = new Date(Math.max(group.end.getTime(), end.getTime()));
                group.items.push(item);
                matchingGroups.slice(1).forEach(otherGroup => {
                    group.end = new Date(Math.max(group.end.getTime(), otherGroup.end.getTime()));
                    group.items.push(...otherGroup.items);
                    overlapGroups.splice(overlapGroups.indexOf(otherGroup), 1);
                });
            });

            const positionedEvents = overlapGroups.flatMap(group => {
                const laneEndTimes = [];
                const groupItems = [...group.items].sort((a, b) => a.event.parsedStart - b.event.parsedStart);
                const positioned = groupItems.map(item => {
                    const start = item.event.parsedStart || parseScheduleDate(item.event.start_date);
                    const end = parseScheduleDate(item.event.end_date) || start;
                    let lane = laneEndTimes.findIndex(laneEnd => laneEnd <= start);
                    if (lane === -1) lane = laneEndTimes.length;
                    laneEndTimes[lane] = end;
                    return { ...item, lane };
                });
                const laneCount = Math.max(1, laneEndTimes.length);
                return positioned.map(item => ({ ...item, laneCount }));
            });
            const cards = positionedEvents.map(({ event, position, lane, laneCount }) => {
                const color = /^#[0-9a-f]{6}$/i.test(event.color) ? event.color : '#d9e8f3';
                const endTime = formatScheduleTime(event.end_date);
                const cancelled = event.isAnnule ? '<span class="schedule-cancelled">Annulé</span>' : '';
                const room = event.salle?.trim() || 'Salle non indiquée';
                const teacher = event.prof?.trim();
                const group = event.groupe?.trim();
                const left = (lane * 100) / laneCount;
                const right = ((laneCount - lane - 1) * 100) / laneCount;
                return `
                    <article class="schedule-event${event.isAnnule ? ' is-cancelled' : ''}" style="--event-color: ${color}; top: ${position.top}%; height: ${position.height}%; left: calc(${left}% + 22px); right: calc(${right}% + 5px)">
                        <div class="schedule-time">${formatScheduleTime(event.start_date)}${endTime ? ` - ${endTime}` : ''}</div>
                        <h3>${escapeHtml(event.matiere || event.text || 'Cours')}</h3>
                        ${cancelled}
                        <div class="schedule-detail">${escapeHtml(room)}</div>
                        ${teacher ? `<div class="schedule-detail">${escapeHtml(teacher)}</div>` : ''}
                        ${group ? `<div class="schedule-group">${escapeHtml(group)}</div>` : ''}
                    </article>
                `;
            }).join('');
            const cardsHtml = cards || '<div class="schedule-empty">Aucun cours</div>';

            return `
                <section class="schedule-day">
                    <header><strong>${day.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}</strong><span>${day.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span></header>
                    <div class="schedule-events">${cardsHtml}</div>
                </section>
            `;
        }).join('');

        return `
            <section class="schedule-week">
                <h2>Semaine du ${formatScheduleDay(week.start)}</h2>
                <div class="schedule-grid">${columns}</div>
            </section>
        `;
    }

    function openSchedulePrintWindow(events) {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert("Autorise les fenêtres pop-up sur ce site pour lancer l'impression.");
            return;
        }

        const weeks = buildScheduleWeeks(events);
        const weeksHtml = weeks.map(renderScheduleWeek).join('');
        const receivedDays = new Set(events.map(event => scheduleDateKey(event.start_date)).filter(Boolean)).size;
        const htmlDocument = `
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <title>Emploi du temps - ÉcoleDirecte</title>
                <style>
                    @page { size: A4 landscape; margin: 9mm; }
                    :root { color-scheme: light; }
                    * { box-sizing: border-box; }
                    body { margin: 0; color: #183248; font-family: "Segoe UI", Arial, sans-serif; background: #fff; }
                    .print-header { display: flex; justify-content: space-between; align-items: end; margin-bottom: 5mm; border-bottom: 2px solid #0b4e84; padding-bottom: 3mm; }
                    h1 { margin: 0; color: #0b4e84; font-size: 22px; }
                    .print-subtitle { color: #668096; font-size: 11px; }
                    .schedule-week { page-break-after: always; }
                    .schedule-week:last-child { page-break-after: auto; }
                    .schedule-week > h2 { margin: 0 0 3mm; color: #0b4e84; font-size: 15px; text-transform: capitalize; }
                    .schedule-grid { display: flex; align-items: stretch; width: 100%; border: 1px solid #b8cbd8; min-height: 164mm; }
                    .schedule-day { flex: 1 1 0; min-width: 0; width: 20%; border-right: 1px solid #b8cbd8; page-break-inside: avoid; break-inside: avoid; }
                    .schedule-day:last-child { border-right: 0; }
                    .schedule-day > header { display: flex; justify-content: space-between; align-items: baseline; gap: 4px; padding: 7px 6px; background: #e8f1f6; border-bottom: 1px solid #b8cbd8; color: #0b4e84; text-transform: capitalize; font-size: 11px; }
                    .schedule-day > header span { color: #668096; font-size: 10px; }
                    .schedule-events { position: relative; height: 150mm; overflow: hidden; background: repeating-linear-gradient(to bottom, transparent 0, transparent calc(10% - 1px), #dce7ed calc(10% - 1px), #dce7ed 10%); }
                    .schedule-events::before { position: absolute; inset: 0 auto 0 2px; color: #78909f; content: '08:00\\A\\A09:00\\A\\A10:00\\A\\A11:00\\A\\A12:00\\A\\A13:00\\A\\A14:00\\A\\A15:00\\A\\A16:00\\A\\A17:00\\A\\A18:00'; font-size: 7px; line-height: 15mm; white-space: pre; pointer-events: none; }
                    .schedule-event { position: absolute; left: 22px; right: 5px; margin: 0; min-height: 3mm; overflow: hidden; padding: 4px; border-left: 4px solid var(--event-color); border-radius: 3px; background: color-mix(in srgb, var(--event-color) 24%, white); break-inside: avoid; font-size: 8px; }
                    .schedule-event h3 { margin: 2px 0 4px; color: #173c56; font-size: 10px; line-height: 1.15; }
                    .schedule-time { color: #0b4e84; font-size: 9px; font-weight: 700; }
                    .schedule-detail { overflow: hidden; color: #536b7c; text-overflow: ellipsis; white-space: nowrap; }
                    .schedule-group { display: inline-block; margin-top: 4px; padding: 2px 4px; border-radius: 3px; background: rgba(11, 78, 132, .12); color: #0b4e84; font-size: 8px; }
                    .schedule-cancelled { color: #a52c2c; font-size: 8px; font-weight: 700; text-transform: uppercase; }
                    .is-cancelled { opacity: .62; text-decoration: line-through; }
                    .schedule-empty { padding: 15px 4px; color: #9aabb6; font-size: 9px; text-align: center; }
                    @media print {
                        body { color: #000; }
                        .print-header { border-bottom-color: #000; }
                        h1, .schedule-week > h2, .schedule-time { color: #000 !important; }
                        .schedule-grid { border-color: #000; }
                        .schedule-day { border-right-color: #000; }
                        .schedule-day > header { background: #e8f1f6 !important; border-bottom-color: #000; color: #000; }
                        .schedule-day > header span, .schedule-detail { color: #000; }
                        .schedule-events { background: repeating-linear-gradient(to bottom, transparent 0, transparent calc(10% - 1px), #999 calc(10% - 1px), #999 10%); }
                        .schedule-events::before { color: #000; font-weight: 700; }
                        .schedule-event { background: color-mix(in srgb, var(--event-color) 32%, white) !important; border: 1px solid #000; border-left: 5px solid var(--event-color); color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .schedule-event h3, .schedule-group { color: #000; }
                        .schedule-group { border: 1px solid #000; background: rgba(255, 255, 255, .65); }
                        .schedule-cancelled { color: #000; font-weight: 800; }
                        .schedule-empty { color: #000; }
                    }
                </style>
            </head>
            <body>
                <header class="print-header"><h1>Emploi du temps</h1><div class="print-subtitle">ÉcoleDirecte · ${events.length} cours · ${receivedDays} jours · ${new Date().toLocaleDateString('fr-FR')}</div></header>
                ${weeksHtml}
                <script>window.onload = function() { window.focus(); window.print(); };</script>
            </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(htmlDocument);
        printWindow.document.close();
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

    function injectButton(type) {
        if (!document.body || !document.head || document.getElementById('ed-custom-print-btn')) return;

        const isSchedule = type === 'schedule';
        const btn = document.createElement('button');
        btn.id = 'ed-custom-print-btn';
        btn.dataset.edPrintType = type;
        btn.type = 'button';
        btn.setAttribute('aria-label', isSchedule ? 'Imprimer l’emploi du temps' : 'Imprimer les devoirs à venir');
        btn.title = isSchedule ? 'Imprimer l’emploi du temps en A4 paysage' : 'Imprimer les devoirs à venir';
        btn.innerHTML = `
            <span class="ed-print-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/>
                    <path d="M7 14h10v7H7zM18 12h.01"/>
                </svg>
            </span>
            <span class="ed-print-label">${isSchedule ? 'Imprimer l’emploi du temps' : 'Imprimer les devoirs'}</span>
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

        btn.addEventListener('click', () => isSchedule ? collectSchedule(btn) : collectFutureHomework(btn));

        document.body.appendChild(btn);
    }

    function checkUrlAndInject() {
        if (!document.body) return;

        const urlLower = window.location.href.toLowerCase();
        const isSchedule = urlLower.includes('emploidutemps') || urlLower.includes('emploi-du-temps');
        const isHomework = urlLower.includes('cahierdetexte') || urlLower.includes('cahier-de-texte') || urlLower.includes('travail-a-faire');
        const button = document.getElementById('ed-custom-print-btn');
        if (isSchedule) {
            if (button && button.dataset.edPrintType !== 'schedule') button.remove();
            injectButton('schedule');
        } else if (isHomework) {
            if (button && button.dataset.edPrintType !== 'homework') button.remove();
            injectButton('homework');
        } else {
            if (button) button.remove();
        }
    }

    const observer = new MutationObserver(checkUrlAndInject);
    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, { childList: true, subtree: true });
            checkUrlAndInject();
        });
    }

    checkUrlAndInject();
})();