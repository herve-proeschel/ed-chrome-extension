import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';

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
function formatDate(value) { return new Date(value).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); }
function formatHomeworkDate(value) {
    const parts = String(value || '').split('-');
    if (parts.length !== 3) return String(value || '');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
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

function sanitizeHomeworkHtml(value) {
    const container = document.createElement('div');
    container.innerHTML = decodeBase64Utf8(value);
    const allowedTags = new Set(['BR', 'EM', 'I', 'LI', 'OL', 'P', 'STRONG', 'U', 'UL']);
    container.querySelectorAll('*').forEach(element => {
        if (!allowedTags.has(element.tagName)) {
            element.replaceWith(document.createTextNode(element.textContent || ''));
            return;
        }
        [...element.attributes].forEach(attribute => element.removeAttribute(attribute.name));
    });
    return { __html: container.innerHTML };
}

function ScheduleEvent({ event }) {
    const start = parseDate(event.start_date);
    const end = parseDate(event.end_date) || start;
    if (!start || !end) return null;
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const visibleStart = Math.max(480, startMinutes);
    const visibleEnd = Math.min(1080, Math.max(visibleStart + 1, endMinutes));
    if (visibleStart >= 1080 || visibleEnd <= 480) return null;
    const color = /^#[0-9a-f]{6}$/i.test(event.color) ? event.color : '#d9e8f3';
    const left = (event.lane * 100) / event.laneCount;
    const right = ((event.laneCount - event.lane - 1) * 100) / event.laneCount;
    return <article className={`schedule-event${event.isAnnule ? ' is-cancelled' : ''}`} style={{ '--event-color': color, top: `${((visibleStart - 480) / 600) * 100}%`, height: `${((visibleEnd - visibleStart) / 600) * 100}%`, left: `calc(${left}% + 22px)`, right: `calc(${right}% + 5px)` }}>
        <h3>{event.matiere || event.text || 'Cours'}</h3>
        {event.isAnnule && <span className="schedule-cancelled">Annulé</span>}
        <div>{event.salle?.trim() || 'Salle non indiquée'}</div>
        {event.prof?.trim() && <div>{event.prof.trim()}</div>}
        {event.groupe?.trim() && <div className="schedule-group">{event.groupe.trim()}</div>}
    </article>;
}

function ScheduleWeek({ week }) {
    return <section className="schedule-week">
        <h2>Semaine du {formatDate(week.start)}</h2>
        <div className="schedule-grid">{Array.from({ length: 5 }, (_, index) => {
            const day = new Date(week.start); day.setDate(day.getDate() + index);
            const key = dateKey(day);
            const dayEvents = week.events.filter(event => event.scheduleDateKey === key).sort((a, b) => parseDate(a.start_date) - parseDate(b.start_date));
            const lanes = [];
            const positioned = dayEvents.map(event => {
                const start = parseDate(event.start_date); const end = parseDate(event.end_date) || start;
                let lane = lanes.findIndex(laneEnd => laneEnd <= start);
                if (lane === -1) lane = lanes.length;
                lanes[lane] = end;
                return { event, lane };
            });
            const laneCount = Math.max(1, lanes.length);
            return <section className="schedule-day" key={key}>
                <header><strong>{day.toLocaleDateString('fr-FR', { weekday: 'long' })}</strong><span>{day.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span></header>
                <div className="schedule-events">
                    <div className="schedule-hours" aria-hidden="true">{Array.from({ length: 11 }, (_, hour) => <span className="schedule-hour" key={hour} style={{ top: `${hour * 10}%` }}>{String(hour + 8).padStart(2, '0')}:00</span>)}</div>
                    {positioned.length ? positioned.map(({ event, lane }) => <ScheduleEvent key={`${event.id || event.start_date}-${lane}`} event={{ ...event, lane, laneCount }} />) : <div className="schedule-empty">Aucun cours</div>}
                </div>
            </section>;
        })}</div>
    </section>;
}

function ScheduleView({ events }) {
    const weeks = new Map();
    events.map(event => ({ ...event, parsedStart: parseDate(event.start_date), scheduleDateKey: scheduleDateKey(event.start_date) }))
        .filter(event => event.parsedStart && event.scheduleDateKey)
        .sort((a, b) => a.parsedStart - b.parsedStart)
        .forEach(event => {
            const start = startOfWeek(event.parsedStart); const key = dateKey(start);
            if (!weeks.has(key)) weeks.set(key, { start, events: [] });
            weeks.get(key).events.push(event);
        });
    return <>{[...weeks.values()].map(week => <ScheduleWeek key={dateKey(week.start)} week={week} />)}</>;
}

function HomeworkView({ days }) {
    return <><h1>Travail à faire (Jours à venir)</h1>{days.map(day => <section className="day-container" key={day.date}>
        <h2>{formatHomeworkDate(day.date).toUpperCase()}</h2>
        {(day.matieres || []).map(subject => {
            const homework = subject.aFaire;
            if (!homework && (!subject.contenuDeSeance || !subject.contenuDeSeance.contenu)) return null;
            return <div className="subject-box" key={subject.matiere}>
                <strong>{subject.matiere || 'Matière'}</strong>
                {homework?.interrogation && <b className="badge">Évaluation / Contrôle</b>}
                <div>{homework ? <div dangerouslySetInnerHTML={sanitizeHomeworkHtml(homework.contenu)} /> : <em>Aucun détail fourni</em>}</div>
            </div>;
        })}
        {!(day.matieres || []).some(subject => subject.aFaire || subject.contenuDeSeance?.contenu) && <p>Aucun travail spécifique à faire enregistré.</p>}
    </section>)}</>;
}

function PrintApp() {
    const data = window.__ED_PRINT_DATA__;
    useEffect(() => {
        document.title = data.type === 'schedule' ? 'Emploi du temps - ÉcoleDirecte' : 'Cahier de texte - Devoirs à venir';
        requestAnimationFrame(() => { window.focus(); window.print(); });
    }, [data.type]);
    return data.type === 'schedule' ? <ScheduleView events={data.data} /> : <HomeworkView days={data.data} />;
}

createRoot(document.getElementById('root')).render(<PrintApp />);
