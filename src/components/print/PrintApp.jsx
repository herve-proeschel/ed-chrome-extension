import React, { useEffect } from 'react';
import HomeworkView from './HomeworkView';
import ScheduleView from './ScheduleView';

export default function PrintApp() {
    const data = window.__ED_PRINT_DATA__;
    useEffect(() => {
        document.title = data.type === 'schedule' ? 'Emploi du temps - ÉcoleDirecte' : 'Cahier de texte - Devoirs à venir';
        requestAnimationFrame(() => { window.focus(); window.print(); });
    }, [data.type]);
    return data.type === 'schedule' ? <ScheduleView events={data.data} /> : <HomeworkView days={data.data} />;
}
