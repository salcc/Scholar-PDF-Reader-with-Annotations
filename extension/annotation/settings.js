// Helper functions for showing status messages
function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = type;
    setTimeout(() => {
        status.style.display = 'none';
    }, 3000);
}

function showSuccess(message) {
    showStatus(message, 'success');
}

function showError(message) {
    showStatus(message, 'error');
}

// Export functionality
document.getElementById('exportBtn').addEventListener('click', async () => {
    try {
        // Get all data from chrome.storage.local
        chrome.storage.local.get(null, (items) => {
            if (chrome.runtime.lastError) {
                showError('Error exporting annotations: ' + chrome.runtime.lastError.message);
                return;
            }

            // Create a JSON file
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            // Create a temporary link and click it to download the file
            const a = document.createElement('a');
            a.href = url;
            a.download = 'annotations-backup-' + new Date().toLocaleString('en-GB').replace(/[:/]/g, '-').replace(/, /g, '_') + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showSuccess('Annotations exported successfully!');
        });
    } catch (error) {
        showError('Error exporting annotations: ' + error.message);
    }
});

// Import functionality
document.getElementById('importInput').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            // First, verify the data structure
            if (typeof data !== 'object') {
                throw new Error('Invalid backup file format');
            }

            // Clear existing annotations
            await new Promise((resolve, reject) => {
                chrome.storage.local.clear(() => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            });

            // Import new annotations
            await new Promise((resolve, reject) => {
                chrome.storage.local.set(data, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            });

            showSuccess('Annotations imported successfully!');
            
            // Reset the file input
            event.target.value = '';
        } catch (error) {
            showError('Error importing annotations: ' + error.message);
        }
    };

    reader.onerror = () => {
        showError('Error reading the file');
    };

    reader.readAsText(file);
});