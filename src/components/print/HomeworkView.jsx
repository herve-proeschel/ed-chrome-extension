import React from 'react';
import { formatHomeworkDate, sanitizeHomeworkHtml } from './printUtils';

export default function HomeworkView({ days }) {
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
