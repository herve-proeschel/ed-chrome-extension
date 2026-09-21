(function () {
    'use strict';
    const ed = window.EDPrint;

    function openPrintWindow(days) {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return alert("Autorise les fenêtres pop-up sur ce site pour lancer l'impression.");
        const content = days.map(day => {
            const subjects = (day.matieres || []).map(subject => {
                const homework = subject.aFaire;
                if (!homework && (!subject.contenuDeSeance || !subject.contenuDeSeance.contenu)) return '';
                const details = homework ? ed.decodeBase64Utf8(homework.contenu) : '';
                return `<div class="subject-box"><strong>${ed.escapeHtml(subject.matiere || 'Matière')}</strong>${homework?.interrogation ? '<b class="badge">Évaluation / Contrôle</b>' : ''}<div>${details || '<em>Aucun détail fourni</em>'}</div></div>`;
            }).join('');
            return `<section class="day-container"><h2>${ed.formatDateFrench(day.date).toUpperCase()}</h2>${subjects || '<p>Aucun travail spécifique à faire enregistré.</p>'}</section>`;
        }).join('');
        printWindow.document.open(); printWindow.document.write(`<!doctype html><html lang="fr"><head><meta charset="UTF-8"><title>Cahier de texte - Devoirs à venir</title><style>body{font-family:Arial,sans-serif;color:#222;margin:20px;line-height:1.4}.day-container{page-break-inside:avoid;margin-bottom:24px}h2{font-size:1.2rem;background:#0b4e84;color:#fff;padding:6px 12px}.subject-box{border:1px solid #ccc;border-left:5px solid #0b4e84;margin-bottom:8px;padding:8px 12px}.badge{float:right;background:#dc3545;color:#fff;padding:2px 5px;font-size:.75rem}</style></head><body><h1>Travail à faire (Jours à venir)</h1>${content}<script>window.onload=function(){window.focus();window.print()}<\/script></body></html>`); printWindow.document.close();
    }

    async function collect(btn) {
        const id = ed.getEleveId(); if (!id) return alert('Identifiant élève introuvable.');
        const label = text => { const element = btn.querySelector('.ed-print-label'); if (element) element.textContent = text; };
        btn.disabled = true; label('Récupération du planning...');
        try {
            const response = await ed.apiRequest(`Eleves/${id}/cahierdetexte.awp`);
            if (!response || response.code !== 200 || !response.data) throw new Error(response?.message || "Erreur de réponse de l'API.");
            const today = new Date().toISOString().split('T')[0]; const dates = Object.keys(response.data).filter(date => date > today).sort();
            if (!dates.length) return alert('Aucun devoir trouvé pour les jours suivants.');
            const days = [];
            for (let index = 0; index < dates.length; index++) { label(`Collecte (${index + 1}/${dates.length}) : ${dates[index]}...`); const day = await ed.apiRequest(`Eleves/${id}/cahierdetexte/${dates[index]}.awp`); if (day?.code === 200 && day.data) days.push(day.data); }
            label('Préparation du document...'); openPrintWindow(days);
        } catch (error) { console.error(error); alert(`Erreur : ${error.message}`); } finally { btn.disabled = false; label('Imprimer les devoirs'); }
    }

    ed.homework = { collect };
}());