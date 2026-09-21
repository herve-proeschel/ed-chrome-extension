import React from 'react';
import ScheduleEvent from './ScheduleEvent';
import { dateKey, formatDate, parseDate } from './printUtils';

export default function ScheduleWeek({ week }) {
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
