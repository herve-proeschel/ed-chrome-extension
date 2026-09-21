(function () {
    'use strict';
    const ed = window.EDPrint;

    function parseDate(value) {
        const raw = String(value || '').trim();
        const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2})(?::(\d{2}))?/);
        if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || 0));
        const fallback = new Date(raw);
        return Number.isNaN(fallback.getTime()) ? null : fallback;
    }

    function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
    function scheduleDateKey(value) { const key = String(value || '').trim().slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : ''; }
    function startOfWeek(date) { const monday = new Date(date); const day = monday.getDay() || 7; monday.setDate(monday.getDate() - day + 1); monday.setHours(0, 0, 0, 0); return monday; }
    function time(value) { const date = parseDate(value); return date ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''; }

    function position(event) {
        const start = parseDate(event.start_date); const end = parseDate(event.end_date) || start;
        if (!start || !end) return null;
        const startMinutes = start.getHours() * 60 + start.getMinutes(); const endMinutes = end.getHours() * 60 + end.getMinutes();
        const visibleStart = Math.max(480, startMinutes); const visibleEnd = Math.min(1080, Math.max(visibleStart + 1, endMinutes));
        if (visibleStart >= 1080 || visibleEnd <= 480) return null;
        return { top: ((visibleStart - 480) / 600) * 100, height: ((visibleEnd - visibleStart) / 600) * 100 };
    }

    function buildWeeks(events) {
        const weeks = new Map();
        events.map(event => ({ ...event, parsedStart: parseDate(event.start_date), scheduleDateKey: scheduleDateKey(event.start_date) }))
            .filter(event => event.parsedStart && event.scheduleDateKey).sort((a, b) => a.parsedStart - b.parsedStart).forEach(event => {
                const start = startOfWeek(event.parsedStart); const key = dateKey(start);
                if (!weeks.has(key)) weeks.set(key, { start, events: [] });
                weeks.get(key).events.push(event);
            });
        return [...weeks.values()];
    }

    function renderWeek(week) {
        const columns = Array.from({ length: 5 }, (_, index) => {
            const day = new Date(week.start); day.setDate(day.getDate() + index); const key = dateKey(day);
            const items = week.events.filter(event => event.scheduleDateKey === key).map(event => ({ event, position: position(event) })).filter(item => item.position);
            const laneEndTimes = [];
            const positionedItems = items.sort((a, b) => parseDate(a.event.start_date) - parseDate(b.event.start_date)).map(item => {
                const start = parseDate(item.event.start_date);
                const end = parseDate(item.event.end_date) || start;
                let lane = laneEndTimes.findIndex(laneEnd => laneEnd <= start);
                if (lane === -1) lane = laneEndTimes.length;
                laneEndTimes[lane] = end;
                return { ...item, lane };
            });
            const laneCount = Math.max(1, laneEndTimes.length);
            const cards = positionedItems.map(({ event, position: itemPosition, lane }) => {
                const color = /^#[0-9a-f]{6}$/i.test(event.color) ? event.color : '#d9e8f3';
                const room = event.salle?.trim() || 'Salle non indiquée'; const teacher = event.prof?.trim(); const group = event.groupe?.trim();
                const left = (lane * 100) / laneCount; const right = ((laneCount - lane - 1) * 100) / laneCount;
                return `<article class="schedule-event${event.isAnnule ? ' is-cancelled' : ''}" style="--event-color:${color};top:${itemPosition.top}%;height:${itemPosition.height}%;left:calc(${left}% + 22px);right:calc(${right}% + 5px)"><div class="schedule-time">${time(event.start_date)} - ${time(event.end_date)}</div><h3>${ed.escapeHtml(event.matiere || event.text || 'Cours')}</h3>${event.isAnnule ? '<span class="schedule-cancelled">Annulé</span>' : ''}<div>${ed.escapeHtml(room)}</div>${teacher ? `<div>${ed.escapeHtml(teacher)}</div>` : ''}${group ? `<div class="schedule-group">${ed.escapeHtml(group)}</div>` : ''}</article>`;
            }).join('');
            return `<section class="schedule-day"><header><strong>${day.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}</strong><span>${day.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span></header><div class="schedule-events">${cards || '<div class="schedule-empty">Aucun cours</div>'}</div></section>`;
        }).join('');
        return `<section class="schedule-week"><h2>Semaine du ${week.start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</h2><div class="schedule-grid">${columns}</div></section>`;
    }

    async function openPrintWindow(events) {
        await ed.openReactPrintWindow('schedule', events, 'assets/styles/schedule.css');
    }

    async function collect(btn) {
        const id = ed.getEleveId(); if (!id) return alert('Identifiant élève introuvable.');
        const label = text => { const element = btn.querySelector('.ed-print-label'); if (element) element.textContent = text; };
        btn.disabled = true; label('Récupération de l’emploi du temps...');
        try {
            const weekStart = startOfWeek(new Date()); const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
            const response = await ed.apiRequest(`E/${id}/emploidutemps.awp`, { v: ed.getApiVersion() }, { dateDebut: dateKey(weekStart), dateFin: dateKey(weekEnd), avecTrous: false });
            if (!response || response.code !== 200 || !Array.isArray(response.data)) throw new Error(response?.message || "Erreur de réponse de l'API.");
            if (!response.data.length) return alert('Aucun cours trouvé dans l’emploi du temps.');
            label('Préparation du document...'); await openPrintWindow(ed.state.displayedScheduleData.length > response.data.length ? ed.state.displayedScheduleData : response.data);
        } catch (error) { console.error(error); alert(`Erreur : ${error.message}`); } finally { btn.disabled = false; label('Imprimer l’emploi du temps'); }
    }

    ed.schedule = { collect };
}());