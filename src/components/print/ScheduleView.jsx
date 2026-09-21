import React from 'react';
import ScheduleWeek from './ScheduleWeek';
import { dateKey, parseDate, scheduleDateKey, startOfWeek } from './printUtils';

export default function ScheduleView({ events }) {
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
