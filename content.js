(function () {
    'use strict';

    function injectButton(type) {
        if (!document.body || !document.head || document.getElementById('ed-custom-print-btn')) return;
        const isSchedule = type === 'schedule';
        const button = document.createElement('button');
        button.id = 'ed-custom-print-btn';
        button.dataset.edPrintType = type;
        button.type = 'button';
        button.setAttribute('aria-label', isSchedule ? 'Imprimer l’emploi du temps' : 'Imprimer les devoirs à venir');
        button.title = isSchedule ? 'Imprimer l’emploi du temps en A4 paysage' : 'Imprimer les devoirs à venir';
        button.innerHTML = `<span class="ed-print-icon" aria-hidden="true">&#128424;</span><span class="ed-print-label">${isSchedule ? 'Imprimer l’emploi du temps' : 'Imprimer les devoirs'}</span>`;
        Object.assign(button.style, {
            position: 'fixed', bottom: '24px', right: '24px', zIndex: '2147483647', display: 'inline-flex',
            alignItems: 'center', gap: '10px', padding: '13px 18px', background: 'linear-gradient(135deg, #0b4e84, #176da8)',
            color: '#fff', border: '1px solid rgba(255,255,255,.72)', borderRadius: '12px',
            boxShadow: '0 10px 24px rgba(5,35,61,.28)', cursor: 'pointer', font: '600 14px/1.2 system-ui'
        });
        const style = document.createElement('style');
        style.textContent = '#ed-custom-print-btn:hover{filter:brightness(1.08);transform:translateY(-2px)}#ed-custom-print-btn:disabled{cursor:wait;opacity:.8}@media(max-width:520px){#ed-custom-print-btn{bottom:14px!important;right:14px!important;padding:12px 14px!important}#ed-custom-print-btn .ed-print-label{display:none}}';
        document.head.appendChild(style);
        button.addEventListener('click', () => isSchedule ? window.EDPrint.schedule.collect(button) : window.EDPrint.homework.collect(button));
        document.body.appendChild(button);
    }

    function checkUrlAndInject() {
        if (!document.body) return;
        const url = window.location.href.toLowerCase();
        const type = url.includes('emploidutemps') || url.includes('emploi-du-temps') ? 'schedule'
            : url.includes('cahierdetexte') || url.includes('cahier-de-texte') || url.includes('travail-a-faire') ? 'homework' : '';
        const button = document.getElementById('ed-custom-print-btn');
        if (button && (!type || button.dataset.edPrintType !== type)) button.remove();
        if (type) injectButton(type);
    }

    const observer = new MutationObserver(checkUrlAndInject);
    function start() { observer.observe(document.body, { childList: true, subtree: true }); checkUrlAndInject(); }
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
}());
