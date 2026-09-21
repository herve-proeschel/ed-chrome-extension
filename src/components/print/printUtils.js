export function parseDate(value) {
    const raw = String(value || '').trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || 0));
    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function scheduleDateKey(value) { const key = String(value || '').trim().slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : ''; }
export function startOfWeek(date) { const monday = new Date(date); const day = monday.getDay() || 7; monday.setDate(monday.getDate() - day + 1); monday.setHours(0, 0, 0, 0); return monday; }
export function formatDate(value) { return new Date(value).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); }
export function formatHomeworkDate(value) {
    const parts = String(value || '').split('-');
    if (parts.length !== 3) return String(value || '');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
export function sanitizeHomeworkHtml(value) {
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

function decodeBase64Utf8(value) {
    if (!value) return '';
    try {
        const binary = atob(value);
        return new TextDecoder('utf-8').decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
    } catch (error) {
        try { return atob(value); } catch (fallbackError) { return value; }
    }
}
