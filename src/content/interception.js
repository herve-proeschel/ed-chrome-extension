(function () {
    'use strict';
    const ed = window.EDPrint;

    function observeBackendRequests() {
        const captureEntry = entry => ed.captureApiVersion(entry && entry.name);
        try { performance.getEntriesByType('resource').forEach(captureEntry); } catch (error) {}
        try {
            const observer = new PerformanceObserver(list => list.getEntries().forEach(captureEntry));
            observer.observe({ type: 'resource', buffered: true });
        } catch (error) {}
    }

    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        try {
            const requestUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url;
            ed.captureApiVersion(requestUrl);
            const headers = args[1] && args[1].headers;
            const token = headers && (headers['X-Token'] || (headers.get && headers.get('X-Token')));
            if (token) ed.saveToken(token);
        } catch (error) {}
        const response = await originalFetch.apply(this, args);
        try {
            const requestUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url;
            response.clone().json().then(data => ed.captureDisplayedSchedule(requestUrl, data)).catch(() => {});
        } catch (error) {}
        return response;
    };

    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
        if (header && header.toLowerCase() === 'x-token') ed.saveToken(value);
        return originalSetRequestHeader.apply(this, arguments);
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function () {
        this._edRequestUrl = arguments[1];
        ed.captureApiVersion(this._edRequestUrl);
        this.addEventListener('load', () => {
            try {
                const data = this.responseType === 'json' ? this.response : JSON.parse(this.responseText);
                ed.captureDisplayedSchedule(this.responseURL || this._edRequestUrl, data);
            } catch (error) {}
        });
        return originalOpen.apply(this, arguments);
    };

    observeBackendRequests();
}());