(function () {
    'use strict';
    const ed = window.EDPrint;

    async function openPrintWindow(days) {
        await ed.openReactPrintWindow('homework', days, 'assets/styles/homework.css');
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
            label('Préparation du document...'); await openPrintWindow(days);
        } catch (error) { console.error(error); alert(`Erreur : ${error.message}`); } finally { btn.disabled = false; label('Imprimer les devoirs'); }
    }

    ed.homework = { collect };
}());