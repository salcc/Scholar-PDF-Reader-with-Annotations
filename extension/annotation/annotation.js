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

// Constants and utilities
const TOOLS = {
    highlight: {
        id: 'highlight-btn',
        colors: ['yellow', 'greenyellow', 'cyan', 'magenta', 'red']
    },
    draw: {
        id: 'draw-btn',
        colors: ['white', 'black', 'red', 'green', 'blue']
    },
    text: {
        id: 'text-btn',
        colors: ['white', 'black', 'red', 'green', 'blue']
    }
};

class ColorPickerManager {
    constructor() {
        this.activeTools = {
            isHighlighting: false,
            isDrawing: false,
            isTexting: false,
            isErasing: false
        };
        this.currentColors = {
            highlight: TOOLS.highlight.colors[0],
            draw: TOOLS.draw.colors[0],
            text: TOOLS.text.colors[0]
        };
        
        // Custom colors for each tool
        this.customColors = {
            highlight: '#FF4500', // Default custom color - orange red
            draw: '#8A2BE2',      // Default custom color - blue violet
            text: '#20B2AA'       // Default custom color - light sea green
        };
        
        // Current HSV values for each tool
        this.hsvValues = {
            highlight: { h: 16, s: 100, v: 100 },  // Orange-red
            draw: { h: 271, s: 76, v: 74 },        // Blue-violet
            text: { h: 174, s: 81, v: 70 }         // Light sea green
        };
        
        // Flags for the color picker drag operations
        this.isDraggingHue = false;
        this.isDraggingSV = false;
        this.activePickerTool = null;
        
        // Add history stacks for undo/redo
        this.undoStack = [];
        this.redoStack = [];
        
        // Add global event listeners for drag operations
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // Set up keyboard shortcuts
        this.setupKeyboardShortcuts();
    }
    
    // Convert HSV to RGB
    hsvToRgb(h, s, v) {
        s = s / 100;
        v = v / 100;
        
        let r, g, b;
        const i = Math.floor(h / 60);
        const f = h / 60 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
        
        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }
        
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }
    
    // Convert RGB to Hex
    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(c => {
            const hex = c.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }
    
    // Convert Hex to RGB
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    
    // Convert RGB to HSV
    rgbToHsv(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, v = max;
        
        const d = max - min;
        s = max === 0 ? 0 : d / max;
        
        if (max === min) {
            h = 0; // achromatic
        } else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        
        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            v: Math.round(v * 100)
        };
    }
    
    // Handle mouse move for dragging operations
    handleMouseMove(e) {
        if (!this.isDraggingHue && !this.isDraggingSV || !this.activePickerTool) return;
        
        const toolType = this.activePickerTool;
        const picker = document.getElementById(`${toolType}-color-picker`);
        
        if (this.isDraggingHue) {
            const hueSlider = picker.querySelector('.hue-slider');
            const rect = hueSlider.getBoundingClientRect();
            let x = e.clientX - rect.left;
            
            // Constrain to the slider width
            x = Math.max(0, Math.min(rect.width, x));
            
            // Calculate hue value (0-360)
            const hue = Math.round((x / rect.width) * 360);
            this.hsvValues[toolType].h = hue;
            
            // Update the hue slider handle position
            const handle = hueSlider.querySelector('.hue-slider-handle');
            handle.style.left = `${x}px`;
            
            // Update the saturation-value picker background color
            const svPicker = picker.querySelector('.saturation-value-picker');
            const hueColor = this.rgbToHex(
                ...Object.values(this.hsvToRgb(hue, 100, 100))
            );
            svPicker.style.backgroundColor = hueColor;
            
            this.updateColorFromHsv(toolType);
        }
        
        if (this.isDraggingSV) {
            const svPicker = picker.querySelector('.saturation-value-picker');
            const rect = svPicker.getBoundingClientRect();
            let x = e.clientX - rect.left;
            let y = e.clientY - rect.top;
            
            // Constrain to the picker area
            x = Math.max(0, Math.min(rect.width, x));
            y = Math.max(0, Math.min(rect.height, y));
            
            // Calculate saturation and value
            const s = Math.round((x / rect.width) * 100);
            const v = Math.round(100 - (y / rect.height) * 100);
            
            this.hsvValues[toolType].s = s;
            this.hsvValues[toolType].v = v;
            
            // Update the handle position
            const handle = svPicker.querySelector('.picker-handle');
            handle.style.left = `${x}px`;
            handle.style.top = `${y}px`;
            
            this.updateColorFromHsv(toolType);
        }
    }
    
    // Handle mouse up to end drag operations
    handleMouseUp() {
        this.isDraggingHue = false;
        this.isDraggingSV = false;
    }
    
    // Update color based on current HSV values
    updateColorFromHsv(toolType) {
        const hsv = this.hsvValues[toolType];
        const rgb = this.hsvToRgb(hsv.h, hsv.s, hsv.v);
        const hex = this.rgbToHex(rgb.r, rgb.g, rgb.b);
        
        // Update the custom color
        this.customColors[toolType] = hex;
        
        // Update the picker UI
        const picker = document.getElementById(`${toolType}-color-picker`);
        const preview = picker.querySelector('.color-preview');
        const hexInput = picker.querySelector('.hex-input');
        const customButton = document.querySelector(`#${toolType}-color-popup .custom-color`);
        
        preview.style.backgroundColor = hex;
        hexInput.value = hex;
        customButton.style.backgroundColor = hex;
        
        // Always update the current color to the new custom color
        this.currentColors[toolType] = hex;
        
        // Update the tool button shadow
        const button = document.getElementById(TOOLS[toolType].id);
        button.style.textShadow = `0 0 10px ${hex}`;
        
        // Update active state in the color popup
        this.updateActiveColor(toolType, customButton);
    }
    
    // Create the custom color picker UI
    createColorPicker(toolType) {
        const colors = TOOLS[toolType].colors;
        const popup = document.createElement('div');
        popup.id = `${toolType}-color-popup`;
        popup.className = 'color-popup';
        
        // Add custom color button at the top
        const customButton = document.createElement('button');
        customButton.className = 'color-option custom-color';
        customButton.setAttribute('data-color', 'custom');
        customButton.title = "Custom color";
        
        // Set the button's background to the current custom color for this tool
        customButton.style.backgroundColor = this.customColors[toolType];
        
        // Create custom color picker
        const picker = document.createElement('div');
        picker.className = 'custom-color-picker';
        picker.id = `${toolType}-color-picker`;
        
        // Hue slider
        const hueSlider = document.createElement('div');
        hueSlider.className = 'hue-slider';
        const hueHandle = document.createElement('div');
        hueHandle.className = 'hue-slider-handle';
        hueSlider.appendChild(hueHandle);
        
        // Saturation/Value picker
        const svPicker = document.createElement('div');
        svPicker.className = 'saturation-value-picker';
        const whiteGradient = document.createElement('div');
        whiteGradient.className = 'white-gradient';
        const blackGradient = document.createElement('div');
        blackGradient.className = 'black-gradient';
        const svHandle = document.createElement('div');
        svHandle.className = 'picker-handle';
        svPicker.appendChild(whiteGradient);
        svPicker.appendChild(blackGradient);
        svPicker.appendChild(svHandle);
        
        // Color preview
        const preview = document.createElement('div');
        preview.className = 'color-preview';
        
        // Hex input
        const hexInput = document.createElement('input');
        hexInput.type = 'text';
        hexInput.className = 'hex-input';
        hexInput.maxLength = 7;
        hexInput.placeholder = '#RRGGBB';
        
        // Add all elements to the picker
        picker.appendChild(hueSlider);
        picker.appendChild(svPicker);
        picker.appendChild(preview);
        picker.appendChild(hexInput);
        
        // Initialize picker UI based on current color
        const hsv = this.hsvValues[toolType];
        const rgb = this.hsvToRgb(hsv.h, hsv.s, hsv.v);
        const hex = this.rgbToHex(rgb.r, rgb.g, rgb.b);
        
        // Set initial positions and colors
        const huePos = (hsv.h / 360) * 100;
        hueHandle.style.left = `${huePos}%`;
        
        svPicker.style.backgroundColor = this.rgbToHex(
            ...Object.values(this.hsvToRgb(hsv.h, 100, 100))
        );
        
        svHandle.style.left = `${hsv.s}%`;
        svHandle.style.top = `${100 - hsv.v}%`;
        
        preview.style.backgroundColor = hex;
        hexInput.value = hex;
        
        // Add event listeners for the picker
        hueSlider.addEventListener('mousedown', (e) => {
            this.isDraggingHue = true;
            this.activePickerTool = toolType;
            this.handleMouseMove(e);
        });
        
        svPicker.addEventListener('mousedown', (e) => {
            this.isDraggingSV = true;
            this.activePickerTool = toolType;
            this.handleMouseMove(e);
        });
        
        hexInput.addEventListener('input', (e) => {
            const newHex = e.target.value;
            if (/^#[0-9A-F]{6}$/i.test(newHex)) {
                const rgb = this.hexToRgb(newHex);
                if (rgb) {
                    const hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
                    this.hsvValues[toolType] = hsv;
                    
                    // Update UI positions
                    const huePos = (hsv.h / 360) * 100;
                    hueHandle.style.left = `${huePos}%`;
                    
                    svPicker.style.backgroundColor = this.rgbToHex(
                        ...Object.values(this.hsvToRgb(hsv.h, 100, 100))
                    );
                    
                    svHandle.style.left = `${hsv.s}%`;
                    svHandle.style.top = `${100 - hsv.v}%`;
                    
                    preview.style.backgroundColor = newHex;
                    
                    // Use updateColorFromHsv to update everything consistently
                    this.updateColorFromHsv(toolType);
                }
            }
        });
        
        // Add the picker to the custom button
        customButton.appendChild(picker);
        popup.appendChild(customButton);
        
        // Add the predefined colors
        colors.forEach(color => {
            const button = document.createElement('button');
            button.className = 'color-option';
            button.setAttribute('data-color', color);
            button.style.backgroundColor = color;
            if (color === this.currentColors[toolType]) {
                button.classList.add('active');
            }
            popup.appendChild(button);
        });

        return popup;
    }

    setupToolButton(toolType) {
        const container = document.createElement('div');
        container.className = 'tool-container';
        
        const button = document.getElementById(TOOLS[toolType].id);
        const popup = this.createColorPicker(toolType);
        
        // Move the button into the container and add the popup
        button.parentNode.insertBefore(container, button);
        container.appendChild(button);
        container.appendChild(popup);
        
        // Initialize the button shadow right after creating it
        button.style.textShadow = `0 0 10px ${this.currentColors[toolType]}`;

        let hideTimeout;

        container.addEventListener('mouseenter', () => {
            clearTimeout(hideTimeout);
            popup.style.display = 'block';
        });

        container.addEventListener('mouseleave', () => {
            hideTimeout = setTimeout(() => {
                popup.style.display = 'none';
                
                // Hide all color pickers
                document.querySelectorAll('.custom-color-picker').forEach(picker => {
                    picker.style.display = 'none';
                });
            }, 100);
        });
        
        // Setup hover behavior for custom color button
        const customButton = popup.querySelector('.custom-color');
        const picker = customButton.querySelector('.custom-color-picker');
        
        customButton.addEventListener('mouseenter', () => {
            // Hide any other open pickers first
            document.querySelectorAll('.custom-color-picker').forEach(p => {
                p.style.display = 'none';
            });
            picker.style.display = 'block';
        });
        
        // Make clicking on the custom color button activate the color
        customButton.addEventListener('click', (e) => {
            // Only process clicks on the button itself, not the picker
            if (e.target === customButton) {
                this.currentColors[toolType] = this.customColors[toolType];
                this.updateActiveColor(toolType, customButton);
            }
            
            // Prevent event from bubbling
            e.stopPropagation();
        });
        
        // Handle regular color option clicks
        popup.querySelectorAll('.color-option:not(.custom-color)').forEach(option => {
            option.addEventListener('click', (e) => {
                this.currentColors[toolType] = e.target.getAttribute('data-color');
                this.updateActiveColor(toolType, e.target);
            });
        });

        return container;
    }

    updateActiveColor(toolType, activeOption) {
        const popup = document.getElementById(`${toolType}-color-popup`);
        popup.querySelectorAll('.color-option').forEach(option => {
            option.classList.remove('active');
        });
        activeOption.classList.add('active');
        
        const button = document.getElementById(TOOLS[toolType].id);
        button.style.textShadow = `0 0 10px ${this.currentColors[toolType]}`;
        
        // Only try to activate implemented tools
        if (toolType === 'highlight') {
            // Deactivate all other tools first
            Object.keys(this.activeTools).forEach(key => {
                this.activeTools[key] = false;
            });
            
            // Activate this tool
            this.activeTools.isHighlighting = true;
            
            // Update all button states
            this.updateButtonStates();
            
            // Update cursor
            this.updateCursor({ target: document.elementFromPoint(mouseX, mouseY) });
        } else if (toolType === 'draw' || toolType === 'text') {
            // For unimplemented tools, show the alert but don't activate the tool
            alert('This feature is not implemented yet!');
        }
    }

    updateButtonStates() {
        Object.keys(TOOLS).forEach(tool => {
            const button = document.getElementById(TOOLS[tool].id);
            const isActive = this.activeTools[`is${tool.charAt(0).toUpperCase() + tool.slice(1)}ing`];
            button.classList.toggle('active', isActive);
        });
        
        const eraseBtn = document.getElementById('erase-btn');
        eraseBtn.classList.toggle('active', this.activeTools.isErasing);
    }

    updateCursor(event) {
        if (this.activeTools.isHighlighting) {
            document.body.style.cursor = 'crosshair';
        } else if (this.activeTools.isDrawing) {
            document.body.style.cursor = 'crosshair';
        } else if (this.activeTools.isTexting) {
            document.body.style.cursor = 'text';
        } else if (this.activeTools.isErasing) {
            document.body.style.cursor = 'pointer';
        } else {
            const target = event.target;
            const isTextElement = target.nodeType === Node.TEXT_NODE ||
                (target.nodeType === Node.ELEMENT_NODE &&
                    ['P', 'SPAN', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'FIGCAPTION'].includes(target.tagName));
            document.body.style.cursor = isTextElement ? 'text' : 'default';
        }
    }
    
    // Set up keyboard shortcuts for tools and color cycling
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts if user is typing in an input field or contenteditable element
            if (e.target.tagName === 'INPUT' || 
                e.target.tagName === 'TEXTAREA' || 
                e.target.isContentEditable) {
                return;
            }
            
            // Check for Ctrl/Cmd + Z (Undo) and Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z (Redo)
            if (e.ctrlKey || e.metaKey) {
                if (e.key.toLowerCase() === 'z') {
                    if (e.shiftKey) {
                        // Ctrl/Cmd + Shift + Z for Redo
                        e.preventDefault();
                        this.redo();
                        return;
                    } else {
                        // Ctrl/Cmd + Z for Undo
                        e.preventDefault();
                        this.undo();
                        return;
                    }
                } else if (e.key.toLowerCase() === 'y') {
                    // Ctrl/Cmd + Y for Redo
                    e.preventDefault();
                    this.redo();
                    return;
                }
            }
            
            // Handle different shortcuts
            switch(e.key.toLowerCase()) {
                case 'h':
                    // Activate/deactivate highlight tool
                    this.activateTool('highlight');
                    break;
                    
                case 'd':
                    // Activate/deactivate draw tool (not implemented)
                    this.activateTool('draw');
                    break;
                    
                case 't':
                    // Activate/deactivate text tool (not implemented)
                    this.activateTool('text');
                    break;
                    
                case 'e':
                    // Activate/deactivate erase tool
                    this.activateTool('erase');
                    break;
                    
                case 'c':
                    // Cycle to next color for the active tool
                    this.cycleToNextColor();
                    break;
                
                case 'escape':
                    // Deactivate all tools
                    this.deactivateAllTools();
                    break;
                    
                // Color selection shortcuts (1-5)
                case '1':
                case '2':
                case '3':
                case '4':
                case '5':
                    // Get the color index (0-4) from the key (1-5)
                    const colorIndex = parseInt(e.key) - 1;
                    this.setColorByIndex(colorIndex);
                    break;
            }
        });
    }
    
    // Deactivate all tools (for Escape key)
    deactivateAllTools() {
        let wasAnyToolActive = false;
        
        // Check if any tool was active
        Object.keys(this.activeTools).forEach(key => {
            if (this.activeTools[key]) {
                wasAnyToolActive = true;
            }
            this.activeTools[key] = false;
        });
        
        // Only update UI if we actually deactivated something
        if (wasAnyToolActive) {
            this.updateButtonStates();
            this.updateCursor({ target: document.elementFromPoint(mouseX, mouseY) });
        }
    }
    
    // Activate a specific tool (now handles all tools including eraser)
    activateTool(toolType) {
        // Determine the state key based on tool type
        let toolStateKey;
        if (toolType === 'erase') {
            toolStateKey = 'isErasing';
        } else {
            toolStateKey = `is${toolType.charAt(0).toUpperCase() + toolType.slice(1)}ing`;
        }
        
        // Check if this tool is already active - if so, deactivate it (toggle behavior)
        if (this.activeTools[toolStateKey]) {
            this.activeTools[toolStateKey] = false;
            this.updateButtonStates();
            this.updateCursor({ target: document.elementFromPoint(mouseX, mouseY) });
            return;
        }
        
        // For unimplemented tools, show an alert
        if ((toolType === 'draw' || toolType === 'text')) {
            alert('This feature is not implemented yet!');
            return;
        }
        
        // Reset all tool states
        Object.keys(this.activeTools).forEach(key => {
            this.activeTools[key] = false;
        });
        
        // Activate the requested tool
        this.activeTools[toolStateKey] = true;
        
        // Update UI
        this.updateButtonStates();
        this.updateCursor({ target: document.elementFromPoint(mouseX, mouseY) });
    }
    
    // Set color by index (for number key shortcuts 1-5)
    setColorByIndex(index) {
        // Determine which tool is active
        let activeTool = null;
        
        if (this.activeTools.isHighlighting) {
            activeTool = 'highlight';
        } else if (this.activeTools.isDrawing) {
            activeTool = 'draw';
        } else if (this.activeTools.isTexting) {
            activeTool = 'text';
        }
        
        // If no color tool is active, do nothing
        if (!activeTool) return;
        
        // Get colors for the active tool
        const colors = TOOLS[activeTool].colors;
        
        // Check if the index is valid
        if (index >= 0 && index < colors.length) {
            const newColor = colors[index];
            
            // Update current color
            this.currentColors[activeTool] = newColor;
            
            // Update UI
            const popup = document.getElementById(`${activeTool}-color-popup`);
            const colorOption = popup.querySelector(`.color-option[data-color="${newColor}"]`);
            
            // If we found the color option, update its active state
            if (colorOption) {
                this.updateActiveColor(activeTool, colorOption);
            }
        }
    }
    
    // Cycle to the next color for the active tool
    cycleToNextColor() {
        // Determine which tool is active
        let activeTool = null;
        
        if (this.activeTools.isHighlighting) {
            activeTool = 'highlight';
        } else if (this.activeTools.isDrawing) {
            activeTool = 'draw';
        } else if (this.activeTools.isTexting) {
            activeTool = 'text';
        }
        
        // If no color tool is active, do nothing
        if (!activeTool) return;
        
        const colors = TOOLS[activeTool].colors;
        
        // Find the current color's index
        let currentIndex = -1;
        const currentColor = this.currentColors[activeTool];
        
        // Check if current color is a predefined color
        for (let i = 0; i < colors.length; i++) {
            if (colors[i] === currentColor) {
                currentIndex = i;
                break;
            }
        }
        
        // If using a custom color or the last predefined color, cycle to the first color
        // Otherwise, move to the next color
        const nextIndex = (currentIndex === -1 || currentIndex === colors.length - 1) ? 0 : currentIndex + 1;
        const nextColor = colors[nextIndex];
        
        // Update the current color
        this.currentColors[activeTool] = nextColor;
        
        // Update the UI
        const popup = document.getElementById(`${activeTool}-color-popup`);
        const colorOption = popup.querySelector(`.color-option[data-color="${nextColor}"]`);
        
        // If we found the color option, update its active state
        if (colorOption) {
            this.updateActiveColor(activeTool, colorOption);
        }
    }
    
    // Add an action to the undo history
    addToHistory(action) {
        // Clear redo stack when a new action is performed
        this.redoStack = [];
        this.undoStack.push(action);
    }

    // Perform an undo operation
    undo() {
        if (this.undoStack.length === 0) return;
        
        const action = this.undoStack.pop();
        this.redoStack.push(action);
        
        console.log('Undoing action:', action);
        
        if (action.type === 'highlight') {
            // Undo a highlight action by removing the highlight
            this.removeHighlightById(action.groupId);
        } 
        else if (action.type === 'erase') {
            // Undo an erase action by restoring the highlights
            this.restoreHighlights(action.highlightGroups);
        }
        else if (action.type === 'eraseAll') {
            // Undo an eraseAll action by restoring all highlights
            this.restoreHighlights(action.highlightGroups);
        }
    }

    // Perform a redo operation
    redo() {
        if (this.redoStack.length === 0) return;
        
        const action = this.redoStack.pop();
        this.undoStack.push(action);
        
        console.log('Redoing action:', action);
        
        if (action.type === 'highlight') {
            // Redo a highlight action by recreating the highlight
            this.recreateHighlight(action);
        } 
        else if (action.type === 'erase') {
            // Redo an erase action by removing the highlights again
            this.removeHighlightById(action.groupId);
        }
        else if (action.type === 'eraseAll') {
            // Redo an eraseAll action by removing all highlights again
            action.highlightGroups.forEach(group => {
                this.removeHighlightById(group.id);
            });
        }
    }

    // Remove a highlight by its groupId
    removeHighlightById(groupId) {
        chrome.storage.local.get([pdfUrl], function (result) {
            if (chrome.runtime.lastError) {
                console.error('Error loading annotations:', chrome.runtime.lastError);
                return;
            }

            const savedAnnotations = result[pdfUrl] || [];
            const groupIndex = savedAnnotations.findIndex(group => group.id === groupId);
            
            if (groupIndex !== -1) {
                const group = savedAnnotations[groupIndex];
                
                // Remove highlight spans from DOM
                document.querySelectorAll(`[data-group-id="${groupId}"]`).forEach(span => {
                    const parent = span.parentNode;
                    const textContent = span.textContent;
                    const textNode = document.createTextNode(textContent);
                    parent.replaceChild(textNode, span);
                });
                
                // Remove from storage
                savedAnnotations.splice(groupIndex, 1);
                chrome.storage.local.set({ [pdfUrl]: savedAnnotations });
                
                // Normalize to combine adjacent text nodes
                document.body.normalize();
            }
        });
    }

    // Restore highlights that were previously erased
    restoreHighlights(highlightGroups) {
        chrome.storage.local.get([pdfUrl], function (result) {
            if (chrome.runtime.lastError) {
                console.error('Error loading annotations:', chrome.runtime.lastError);
                return;
            }

            const savedAnnotations = result[pdfUrl] || [];
            
            // Add all groups back to storage
            highlightGroups.forEach(group => {
                if (!savedAnnotations.some(existing => existing.id === group.id)) {
                    savedAnnotations.push(group);
                }
            });
            
            chrome.storage.local.set({ [pdfUrl]: savedAnnotations }, function() {
                // After saving, reapply the highlights to the page
                highlightGroups.forEach(group => {
                    const pageElements = document.querySelectorAll('.gsr-page');
                    pageElements.forEach(pageElement => {
                        const textContainer = pageElement.querySelector('.gsr-text-ctn');
                        if (textContainer) {
                            group.nodes.forEach(nodeInfo => {
                                const node = findNodeInPage(textContainer, nodeInfo.xpath, nodeInfo.text);
                                if (node) {
                                    highlightNode(node, nodeInfo.text, group.color || currentColor, group.id);
                                }
                            });
                        }
                    });
                });
            });
        });
    }

    // Recreate a highlight that was previously removed
    recreateHighlight(action) {
        chrome.storage.local.get([pdfUrl], function (result) {
            if (chrome.runtime.lastError) {
                console.error('Error loading annotations:', chrome.runtime.lastError);
                return;
            }

            const savedAnnotations = result[pdfUrl] || [];
            
            // Add the highlight group back to storage if it doesn't exist
            if (!savedAnnotations.some(group => group.id === action.groupId)) {
                savedAnnotations.push(action.highlightGroup);
                
                chrome.storage.local.set({ [pdfUrl]: savedAnnotations }, function() {
                    // After saving, reapply the highlight to the page
                    const group = action.highlightGroup;
                    const pageElements = document.querySelectorAll('.gsr-page');
                    
                    pageElements.forEach(pageElement => {
                        const textContainer = pageElement.querySelector('.gsr-text-ctn');
                        if (textContainer) {
                            group.nodes.forEach(nodeInfo => {
                                const node = findNodeInPage(textContainer, nodeInfo.xpath, nodeInfo.text);
                                if (node) {
                                    highlightNode(node, nodeInfo.text, group.color || currentColor, group.id);
                                }
                            });
                        }
                    });
                });
            }
        });
    }
}

function initializeAnnotation() {
    // clear legacy empty-key entries from storage
    chrome.storage.local.remove([''], () => console.log('Cleared legacy empty-key entries'));

    console.log('Initializing annotation...');
    const colorPickerManager = new ColorPickerManager();
    
    // Store the instance globally for access from other functions
    window.colorPickerManagerInstance = colorPickerManager;

    // Set up message listener for PDF URL
    window.addEventListener("message", (event) => {
        if (event.data.type === "FROM_CONTENT_SCRIPT") {
            const receivedPdfUrl = event.data.pdfUrl;
            if (receivedPdfUrl === '__proto__' || receivedPdfUrl === 'constructor' || receivedPdfUrl === 'prototype') {
                console.error('Invalid PDF URL received:', receivedPdfUrl);
                return;
            }
            pdfUrl = receivedPdfUrl;
            console.log('PDF URL received:', pdfUrl);
        }
    }, false);

    // Initialize color pickers for each tool
    Object.keys(TOOLS).forEach(tool => {
        colorPickerManager.setupToolButton(tool);
    });

    // Set up button click handlers
    setupButtonHandlers(colorPickerManager);

    // Set up document event listeners with the manager instance
    document.addEventListener('mouseup', () => handleSelection(colorPickerManager));
    document.addEventListener('click', (e) => handleErase(e, colorPickerManager));

    observePageChanges();
}

function hexToPdfRgb(colorStr) {
    const namedColors = {
        "yellow": "#FFFF00",
        "greenyellow": "#ADFF2F",
        "cyan": "#00FFFF",
        "magenta": "#FF00FF",
        "red": "#FF0000",
        "white": "#FFFFFF",
        "black": "#000000",
        "green": "#008000",
        "blue": "#0000FF",
    };

    // Convert named colors to hex
    if (namedColors[colorStr.toLowerCase()]) {
        colorStr = namedColors[colorStr.toLowerCase()];
    }

    // Validate hex color
    const hexMatch = colorStr.match(/^#?([a-fA-F0-9]{6})$/);
    if (!hexMatch) {
        console.warn(`Invalid color: ${colorStr}, defaulting to yellow.`);
        colorStr = "#FFFF00";  // default fallback
    }

    const hex = colorStr.replace('#', '');
    const r = parseInt(hex.substring(0,2), 16) / 255;
    const g = parseInt(hex.substring(2,4), 16) / 255;
    const b = parseInt(hex.substring(4,6), 16) / 255;
    return PDFLib.rgb(r, g, b);
}

async function exportAnnotatedPdf() {
    if (!pdfUrl) {
        alert('No PDF loaded.');
        return;
    }

    const pdfData = await fetch(pdfUrl).then(res => res.arrayBuffer());
    const pdfDoc = await PDFLib.PDFDocument.load(pdfData);
    const pages = pdfDoc.getPages();

    chrome.storage.local.get([pdfUrl], async (result) => {
        const annotations = result[pdfUrl] || [];

        annotations.forEach(annotation => {
            annotation.nodes.forEach(node => {
                const pos = node.position;
                const pageIndex = pos.pageIndex;

                if (pageIndex < pages.length) {
                    const pdfPage = pages[pageIndex];
                    const { width: pdfWidth, height: pdfHeight } = pdfPage.getSize();

                    const x = (pos.xPercent / 100) * pdfWidth;
                    const y = pdfHeight - ((pos.yPercent / 100) * pdfHeight) - ((pos.heightPercent / 100) * pdfHeight);
                    const width = (pos.widthPercent / 100) * pdfWidth;
                    const height = (pos.heightPercent / 100) * pdfHeight;

                    pdfPage.drawRectangle({
                        x, y, width, height,
                        color: hexToPdfRgb(annotation.color),
                        opacity: 0.4,
                        borderWidth: 0
                    });
                }
            });
        });

        const pdfBytes = await pdfDoc.save();
        download(pdfBytes, "annotated.pdf");
    });
}


function download(data, filename) {
    const blob = new Blob([data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// Helper: Extract page number from XPath (implement this according to your XPath structure)
function extractPageNumberFromXPath(xpath) {
    // Example: '/div[1]/div[2]' -> page 1 (0-indexed)
    const match = xpath.match(/div\[(\d+)\]/);
    return match ? parseInt(match[1]) - 1 : 0;
}


function setupButtonHandlers(colorPickerManager) {
    const alertNotImplemented = () => alert('This feature is not implemented yet!');

    // Tool buttons
    document.getElementById(TOOLS.highlight.id).addEventListener('click', () => {
        colorPickerManager.activateTool('highlight');
    });
    document.getElementById(TOOLS.draw.id).addEventListener('click', alertNotImplemented);
    document.getElementById(TOOLS.text.id).addEventListener('click', alertNotImplemented);

    // Other buttons
    document.getElementById('erase-btn').addEventListener('click', () => {
        colorPickerManager.activateTool('erase');
    });

    document.getElementById('erase-all-btn').addEventListener('click', eraseAllAnnotations);
    
    document.getElementById('settings-btn').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
    
    document.getElementById('export-btn').addEventListener('click', exportAnnotatedPdf);

    document.getElementById('star-btn').addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://github.com/salcc/Scholar-PDF-Reader-with-Annotations' });
    });
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

function handleSelection(colorPickerManager) {
    if (!colorPickerManager.activeTools.isHighlighting || colorPickerManager.activeTools.isErasing) return;

    if (!pdfUrl) {
        console.warn('Document not ready yet — please wait a moment.');
        return;
    }

    const selection = window.getSelection();
    if (selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const groupId = 'group-' + Date.now();
    // Pass the current color from the manager
    highlightRange(range, groupId, colorPickerManager.currentColors.highlight);
    selection.removeAllRanges();
}

function handleErase(event, colorPickerManager) {
    if (!colorPickerManager.activeTools.isErasing) return;

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

function highlightRange(range, groupId, color) {
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
                highlightedNodes.push(...handleOverlappingHighlights(node, startOffset, endOffset, groupId, existingHighlights, color));
            } else {
                highlightedNodes.push(highlightTextNode(node, startOffset, endOffset, groupId, color));
            }
        }
    });

    // Save annotation and record in history
    saveAnnotation(groupId, highlightedNodes, color);
}

function saveAnnotation(groupId, nodesWithPositions, color) {
    const annotation = {
        id: groupId,
        color: color,
        nodes: nodesWithPositions.map(item => ({
            text: item.span.textContent,
            xpath: getXPath(item.span),
            offset: getTextOffset(item.span),
            position: item.position // Needed for exporting to PDF
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
                console.log('Annotation saved for %s:', pdfUrl, annotation);

                // Add to history for undo/redo
                const historyAction = {
                    type: 'highlight',
                    groupId: groupId,
                    highlightGroup: annotation
                };

                // Access the colorPickerManager instance
                if (window.colorPickerManagerInstance) {
                    window.colorPickerManagerInstance.addToHistory(historyAction);
                }
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


function handleOverlappingHighlights(node, startOffset, endOffset, groupId, existingHighlights, color) {
    const highlightedNodes = [];
    let currentOffset = 0;

    existingHighlights.sort((a, b) => {
        return a.textContent.indexOf(node.textContent) - b.textContent.indexOf(node.textContent);
    });

    existingHighlights.forEach((highlight) => {
        const highlightStart = highlight.textContent.indexOf(node.textContent);
        const highlightEnd = highlightStart + node.textContent.length;

        if (startOffset < highlightStart && currentOffset < highlightStart) {
            highlightedNodes.push(highlightTextNode(node, currentOffset, highlightStart, groupId, color));
        }

        if (startOffset <= highlightEnd && endOffset >= highlightStart) {
            highlight.style.backgroundColor = color;
            highlight.dataset.groupId = groupId;
            highlightedNodes.push(highlight);
        }

        currentOffset = highlightEnd;
    });

    if (endOffset > currentOffset) {
        highlightedNodes.push(highlightTextNode(node, currentOffset, endOffset, groupId, color));
    }

    return highlightedNodes;
}

function highlightTextNode(node, startOffset, endOffset, groupId, color) {
    const range = document.createRange();
    range.setStart(node, startOffset);
    range.setEnd(node, endOffset);

    const rect = range.getBoundingClientRect();
    const highlightSpan = document.createElement('span');
    highlightSpan.className = 'pdf-highlight';
    highlightSpan.style.backgroundColor = color;
    highlightSpan.dataset.groupId = groupId;

    range.surroundContents(highlightSpan);

    const pageElement = highlightSpan.closest('.gsr-page');
    const pageRect = pageElement.getBoundingClientRect();

    // Calculate relative positions (%) within the page
    const position = {
        xPercent: ((rect.left - pageRect.left) / pageRect.width) * 100,
        yPercent: ((rect.top - pageRect.top) / pageRect.height) * 100,
        widthPercent: (rect.width / pageRect.width) * 100,
        heightPercent: (rect.height / pageRect.height) * 100,
        pageIndex: determineCurrentPageIndex(highlightSpan)
    };

    return { span: highlightSpan, position };
}

// You need a helper to determine the PDF page index based on your DOM structure
function determineCurrentPageIndex(node) {
    const pageElement = node.closest('.gsr-page');
    return Array.from(document.querySelectorAll('.gsr-page')).indexOf(pageElement);
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
            
            // Save to history before removing
            if (window.colorPickerManagerInstance) {
                const historyAction = {
                    type: 'erase',
                    groupId: groupId,
                    highlightGroups: [group]
                };
                window.colorPickerManagerInstance.addToHistory(historyAction);
            }
            
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
    if (confirm('Are you sure you want to erase all annotations from this PDF?')) {
        chrome.storage.local.get([pdfUrl], function (result) {
            if (chrome.runtime.lastError) {
                console.error('Error loading annotations:', chrome.runtime.lastError);
                return;
            }

            const savedAnnotations = result[pdfUrl] || [];
            
            // Save to history before removing all
            if (savedAnnotations.length > 0 && window.colorPickerManagerInstance) {
                const historyAction = {
                    type: 'eraseAll',
                    highlightGroups: [...savedAnnotations]  // Clone the array
                };
                window.colorPickerManagerInstance.addToHistory(historyAction);
            }
            
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
    } else {
        console.log('Erase all annotations cancelled');
    }
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
