let isHighlighting = false;
let isErasing = false;
let currentColor = 'yellow';
let pdfUrl = '';
let mouseX = 0;
let mouseY = 0;
document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

function initializeAnnotation() {
    console.log('Initializing annotation...');
    window.addEventListener("message", (event) => {
        if (event.data.type && event.data.type === "FROM_CONTENT_SCRIPT") {
            pdfUrl = event.data.pdfUrl;
            console.log('PDF URL received:', pdfUrl);
        }
    }, false);

    const highlightBtn = document.getElementById('highlight-btn');
    const eraseBtn = document.getElementById('erase-btn');
    const eraseAllBtn = document.getElementById('erase-all-btn');
    const colorPickerBtn = document.getElementById('color-picker-btn');
    const colorOptions = document.querySelectorAll('.color-option');
    const supportBtn = document.getElementById('support-btn');

    highlightBtn.addEventListener('click', toggleHighlighting);
    eraseBtn.addEventListener('click', toggleErasing);
    eraseAllBtn.addEventListener('click', eraseAllAnnotations);
    colorPickerBtn.addEventListener('click', toggleColorPopup);
    supportBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://github.com/salcc/Scholar-PDF-Reader-with-Annotations' });
    });

    colorOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            currentColor = e.target.getAttribute('data-color');
            updateActiveColor(e.target);
            toggleColorPopup();
        });
    });

    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('click', handleErase);

    observePageChanges();
    updateActiveColor(document.querySelector(`.color-option[data-color="${currentColor}"]`));
}

function toggleColorPopup() {
    const popup = document.getElementById('color-popup');
    popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
}

function toggleHighlighting() {
    isHighlighting = !isHighlighting;
    isErasing = false;
    updateButtonStates();
    updateCursor({ target: document.elementFromPoint(mouseX, mouseY) });
}

function toggleErasing() {
    isErasing = !isErasing;
    isHighlighting = false;
    updateButtonStates();
    updateCursor({ target: document.elementFromPoint(mouseX, mouseY) });
}

function updateButtonStates() {
    const highlightBtn = document.getElementById('highlight-btn');
    const eraseBtn = document.getElementById('erase-btn');

    highlightBtn.classList.toggle('active', isHighlighting);
    eraseBtn.classList.toggle('active', isErasing);
}

function updateActiveColor(activeOption) {
    document.querySelectorAll('.color-option').forEach(option => {
        option.classList.remove('active');
    });
    activeOption.classList.add('active');
    document.getElementById('highlight-btn').style.textShadow = `0 0 10px ${currentColor}`;
}

function updateCursor(event) {
    if (isHighlighting) {
        document.body.style.cursor = 'crosshair';
    } else if (isErasing) {
        document.body.style.cursor = 'pointer';
    } else {
        const target = event.target;
        const isTextElement = target.nodeType === Node.TEXT_NODE ||
            (target.nodeType === Node.ELEMENT_NODE &&
                ['P', 'SPAN', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'FIGCAPTION'].includes(target.tagName));
        document.body.style.cursor = isTextElement ? 'text' : 'default';
    }
}


function observePageChanges() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('gsr-text-ctn')) {
                        console.log('New page content loaded, applying annotations');
                        chrome.storage.local.get([pdfUrl], function (result) {
                            if (chrome.runtime.lastError) {
                                console.error('Error loading annotations:', chrome.runtime.lastError);
                                return;
                            }
                            const savedAnnotations = result[pdfUrl] || [];
                            console.log('Loaded annotations:', savedAnnotations);
                            applyAnnotationsToPage(node.closest('.gsr-page'), savedAnnotations);
                        });
                    }
                });
            }
        });
    });

    const config = { childList: true, subtree: true };
    observer.observe(document.body, config);
}


function handleSelection() {
    if (!isHighlighting || isErasing) return;

    const selection = window.getSelection();
    if (selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const groupId = 'group-' + Date.now();
    highlightRange(range, groupId);
    selection.removeAllRanges();
}

function handleErase(event) {
    if (!isErasing) return;

    const highlightSpan = findHighlightSpanAtPoint(event.clientX, event.clientY);
    if (highlightSpan) {
        const groupId = highlightSpan.dataset.groupId;
        eraseAnnotation(groupId);
    }
}

function findHighlightSpanAtPoint(x, y) {
    const elements = document.elementsFromPoint(x, y);
    for (let element of elements) {
        if (element.classList.contains('pdf-highlight')) {
            return element;
        }

        const nestedHighlight = element.querySelector('.pdf-highlight');
        if (nestedHighlight) {
            const rect = nestedHighlight.getBoundingClientRect();
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                return nestedHighlight;
            }
        }
    }
    return null;
}

function highlightRange(range, groupId) {
    const startNode = range.startContainer;
    const endNode = range.endContainer;
    const commonAncestor = range.commonAncestorContainer;

    const highlightedNodes = [];
    const nodesToProcess = getNodesBetween(startNode, endNode, commonAncestor);

    nodesToProcess.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const startOffset = (node === startNode) ? range.startOffset : 0;
            const endOffset = (node === endNode) ? range.endOffset : node.length;

            // Check if the node is already partially highlighted
            const existingHighlights = getExistingHighlights(node);
            if (existingHighlights.length > 0) {
                highlightedNodes.push(...handleOverlappingHighlights(node, startOffset, endOffset, groupId, existingHighlights));
            } else {
                highlightedNodes.push(highlightTextNode(node, startOffset, endOffset, groupId));
            }
        }
    });

    saveAnnotation(groupId, highlightedNodes); // Auto-save after highlighting
}

function saveAnnotation(groupId, nodes) {
    const annotation = {
        id: groupId,
        color: nodes[0].style.backgroundColor,
        nodes: nodes.map(node => ({
            text: node.textContent,
            xpath: getXPath(node),
            offset: getTextOffset(node)
        }))
    };

    chrome.storage.local.get([pdfUrl], function (result) {
        if (chrome.runtime.lastError) {
            console.error('Error loading annotations:', chrome.runtime.lastError);
            return;
        }

        const savedAnnotations = result[pdfUrl] || [];
        const existingIndex = savedAnnotations.findIndex(group => group.id === groupId);
        if (existingIndex !== -1) {
            savedAnnotations[existingIndex] = annotation;
        } else {
            savedAnnotations.push(annotation);
        }

        chrome.storage.local.set({ [pdfUrl]: savedAnnotations }, function () {
            if (chrome.runtime.lastError) {
                console.error('Error saving annotations:', chrome.runtime.lastError);
            } else {
                console.log('Annotation saved for ' + pdfUrl + ':', annotation);
            }
        });
    });
}

function getExistingHighlights(node) {
    const highlights = [];
    while (node && node !== document.body) {
        if (node.classList && node.classList.contains('pdf-highlight')) {
            highlights.push(node);
        }
        node = node.parentNode;
    }
    return highlights;
}

function handleOverlappingHighlights(node, startOffset, endOffset, groupId, existingHighlights) {
    const highlightedNodes = [];
    let currentOffset = 0;

    // Sort existing highlights by their position in the text
    existingHighlights.sort((a, b) => {
        return a.textContent.indexOf(node.textContent) - b.textContent.indexOf(node.textContent);
    });

    existingHighlights.forEach((highlight) => {
        const highlightStart = highlight.textContent.indexOf(node.textContent);
        const highlightEnd = highlightStart + node.textContent.length;

        // Highlight before existing highlight
        if (startOffset < highlightStart && currentOffset < highlightStart) {
            highlightedNodes.push(highlightTextNode(node, currentOffset, highlightStart, groupId));
        }

        // Merge with existing highlight if overlapping
        if (startOffset <= highlightEnd && endOffset >= highlightStart) {
            highlight.style.backgroundColor = currentColor;
            highlight.dataset.groupId = groupId;
            highlightedNodes.push(highlight);
        }

        currentOffset = highlightEnd;
    });

    // Highlight after last existing highlight
    if (endOffset > currentOffset) {
        highlightedNodes.push(highlightTextNode(node, currentOffset, endOffset, groupId));
    }

    return highlightedNodes;
}

function highlightTextNode(node, startOffset, endOffset, groupId) {
    const range = document.createRange();
    range.setStart(node, startOffset);
    range.setEnd(node, endOffset);

    const highlightSpan = document.createElement('span');
    highlightSpan.className = 'pdf-highlight';
    highlightSpan.style.backgroundColor = currentColor;
    highlightSpan.dataset.groupId = groupId;

    range.surroundContents(highlightSpan);
    return highlightSpan;
}

function getNodesBetween(startNode, endNode, commonAncestor) {
    const nodes = [];
    let currentNode = startNode;

    while (currentNode) {
        nodes.push(currentNode);
        if (currentNode === endNode) break;
        currentNode = getNextNode(currentNode, commonAncestor);
    }

    return nodes;
}

function getNextNode(node, stopNode) {
    if (node.firstChild) return node.firstChild;
    while (node) {
        if (node === stopNode) return null;
        if (node.nextSibling) return node.nextSibling;
        node = node.parentNode;
    }
    return null;
}

function removeHighlightGroup(group) {
    group.nodes.forEach(nodeInfo => {
        const node = findNodeByXPath(nodeInfo.xpath);
        if (node) {
            const highlightSpan = node.parentNode.querySelector(`[data-group-id="${group.id}"]`);
            if (highlightSpan) {
                const parent = highlightSpan.parentNode;
                const textContent = highlightSpan.textContent;
                const textNode = document.createTextNode(textContent);
                parent.replaceChild(textNode, highlightSpan);
            } else {
                console.warn('Highlight span not found for node:', node);
            }
        } else {
            // console.warn('Node not found for XPath:', nodeInfo.xpath);
        }
    });

    document.body.normalize();
}

function eraseAnnotation(groupId) {
    chrome.storage.local.get([pdfUrl], function (result) {
        if (chrome.runtime.lastError) {
            console.error('Error loading annotations:', chrome.runtime.lastError);
            return;
        }

        const savedAnnotations = result[pdfUrl] || [];
        const groupIndex = savedAnnotations.findIndex(group => group.id === groupId);
        if (groupIndex !== -1) {
            const group = savedAnnotations[groupIndex];
            
            removeHighlightGroup(group);

            savedAnnotations.splice(groupIndex, 1);

            chrome.storage.local.set({ [pdfUrl]: savedAnnotations }, function () {
                if (chrome.runtime.lastError) {
                    console.error('Error saving annotations:', chrome.runtime.lastError);
                } else {
                    console.log('Annotation removed for groupId:', groupId);
                }
            });
        }
    });
}

function eraseAllAnnotations() {
    chrome.storage.local.get([pdfUrl], function (result) {
        if (chrome.runtime.lastError) {
            console.error('Error loading annotations:', chrome.runtime.lastError);
            return;
        }

        const savedAnnotations = result[pdfUrl] || [];
        savedAnnotations.forEach(group => {
            removeHighlightGroup(group);
        });

        chrome.storage.local.remove([pdfUrl], function () {
            if (chrome.runtime.lastError) {
                console.error('Error removing annotations:', chrome.runtime.lastError);
            } else {
                console.log('All annotations removed for ' + pdfUrl);
            }
        });
    });
}

function findNodeByXPath(xpath) {
    try {
        const nodes = document.evaluate(xpath, document, null, XPathResult.ANY_TYPE, null);
        return nodes.iterateNext();
    } catch (e) {
        console.error('Error finding node by XPath:', xpath, e);
        return null;
    }
}


function applyAnnotationsToPage(pageElement, highlightGroups) {
    const textContainer = pageElement.querySelector('.gsr-text-ctn');
    if (!textContainer) return;

    highlightGroups.forEach(group => {
        group.nodes.forEach(nodeInfo => {
            const node = findNodeInPage(textContainer, nodeInfo.xpath, nodeInfo.text);
            if (node) {
                highlightNode(node, nodeInfo.text, group.color || currentColor, group.id);
            } else {
                // console.warn('Node not found for annotation:', nodeInfo);
            }
        });
    });
}

function findNodeInPage(textContainer, xpath, text) {
    try {
        const xpathResult = document.evaluate(xpath, textContainer, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const node = xpathResult.singleNodeValue;
        if (node && node.textContent.includes(text)) {
            return node;
        }
    } catch (e) {
        console.error('XPath evaluation failed:', e);
    }
    return null;
}


function getXPath(node) {
    const parts = [];
    while (node && node.nodeType === Node.ELEMENT_NODE) {
        let sibling = node;
        let siblingCount = 1;
        while ((sibling = sibling.previousSibling) !== null) {
            if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === node.nodeName) {
                siblingCount++;
            }
        }
        parts.unshift(node.nodeName.toLowerCase() + '[' + siblingCount + ']');
        node = node.parentNode;
    }
    
    // Remove the last element (innermost span)
    parts.pop();
    
    return '/' + parts.join('/');
}

function getTextOffset(node) {
    let offset = 0;
    let currentNode = node;
    while (currentNode.previousSibling) {
        currentNode = currentNode.previousSibling;
        if (currentNode.nodeType === Node.TEXT_NODE) {
            offset += currentNode.textContent.length;
        }
    }
    return offset;
}

function highlightNode(node, text, color, groupId) {
    const range = document.createRange();
    const textNode = node.firstChild;
    if (!textNode) {
        console.warn('No text node found in:', node);
        return null;
    }
    const startOffset = textNode.textContent.indexOf(text);
    if (startOffset !== -1) {
        range.setStart(textNode, startOffset);
        range.setEnd(textNode, startOffset + text.length);
        const highlightSpan = document.createElement('span');
        highlightSpan.className = 'pdf-highlight';
        highlightSpan.style.backgroundColor = color;
        highlightSpan.dataset.groupId = groupId;
        try {
            range.surroundContents(highlightSpan);
            return highlightSpan;
        } catch (e) {
            console.error('Error highlighting node:', e);
            return null;
        }
    } else {
        // console.warn('Text not found in node:', text);
        return null;
    }
}


// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', initializeAnnotation);