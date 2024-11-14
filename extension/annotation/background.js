import '../background-compiled.js';

chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "getPdfUrl") {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                let url = tabs[0].url;
                let cleanUrl = url.split('#')[0]; // Remove the fragment identifier
                chrome.tabs.sendMessage(tabs[0].id, {action: "setPdfUrl", url: cleanUrl});
            }
        });
    }
});