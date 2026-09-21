import React from 'react';
import { parseDate } from './printUtils';

export default function ScheduleEvent({ event }) {
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
