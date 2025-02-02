(function () {
    function injectPdfUrl(pdfUrl) {
        const iframeUrl = chrome.runtime.getURL("reader.html");
        const iframe = document.querySelector(`iframe[src="${iframeUrl}"]`);

        if (iframe) {
            iframe.addEventListener('load', () => {
                iframe.contentWindow.postMessage({ type: "FROM_CONTENT_SCRIPT", pdfUrl: pdfUrl }, "*");
            });
        }
    }

    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "setPdfUrl") {
            injectPdfUrl(message.url);
        }
    });

    function requestPdfUrl() {
        chrome.runtime.sendMessage({ action: "getPdfUrl" });
    }

    // Run when the page is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', requestPdfUrl);
    } else {
        requestPdfUrl();
    }
})();