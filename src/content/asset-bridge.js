(function () {
    'use strict';

    const allowedPaths = /^(assets\/templates\/[^/]+\.html|assets\/styles\/[^/]+\.css|dist\/print\.js)$/;

    window.addEventListener('message', event => {
        const request = event.data;
        if (event.source !== window || !request || request.source !== 'ed-print-main' || request.type !== 'get-url') return;
        if (!allowedPaths.test(request.path)) return;
        window.postMessage({
            source: 'ed-print-bridge',
            type: 'url-response',
            id: request.id,
            path: request.path,
            url: chrome.runtime.getURL(request.path)
        }, '*');
    });
}());
