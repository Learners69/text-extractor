const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MBconst ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const MAX_HISTORY_ITEMS = 5;

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const imagePreview = document.getElementById('imagePreview');
const previewArea = document.querySelector('.preview-area');
const errorMessage = document.querySelector('.error-message');
const previewPlaceholder = document.querySelector('.preview-placeholder');
const loadingIndicator = document.querySelector('.loading-indicator');
const processingContainer = document.querySelector('.processing-container');
const progressBar = document.querySelector('.progress');
const statusText = document.querySelector('.status-text');
const resultText = document.getElementById('resultText');
const copyButton = document.getElementById('copyButton');
const downloadButton = document.getElementById('downloadButton');
const clearButton = document.getElementById('clearButton');
const notificationsContainer = document.getElementById('notifications');
const themeToggle = document.getElementById('themeToggle');
const imageControls = document.querySelector('.image-controls');
const rotateLeftBtn = document.querySelector('.rotate-left');
const rotateRightBtn = document.querySelector('.rotate-right');
const brightnessSlider = document.getElementById('brightnessSlider');
const contrastSlider = document.getElementById('contrastSlider');
const resetImageButton = document.getElementById('resetImageButton');
const historyContainer = document.getElementById('historyContainer');
const clearHistoryButton = document.getElementById('clearHistoryButton');
const extractButton = document.getElementById('extractButton');
const uploadTabs = document.querySelectorAll('.upload-tab');
const uploadContents = document.querySelectorAll('.upload-content');
const pasteZone = document.getElementById('pasteZone');

let currentWorker = null;
let isProcessing = false;
let currentRotation = 0;
let currentImageData = null;
let currentBrightness = 100;
let currentContrast = 100;

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// History Management
function initHistory() {
    const history = getHistory();
    updateHistoryUI(history);
}

function getHistory() {
    return JSON.parse(localStorage.getItem('imageHistory') || '[]');
}

function addToHistory(imageData) {
    const history = getHistory();
    history.unshift({
        id: Date.now(),
        data: imageData,
        timestamp: new Date().toISOString()
    });
    
    // Keep only recent items
    const updatedHistory = history.slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem('imageHistory', JSON.stringify(updatedHistory));
    updateHistoryUI(updatedHistory);
}

function updateHistoryUI(history) {
    if (history.length === 0) {
        historyContainer.innerHTML = '<p class="empty-history">No recent images</p>';
        return;
    }
    
    historyContainer.innerHTML = history.map(item => `
        <div class="history-item" data-id="${item.id}" tabindex="0" role="button" aria-label="Load image from history">
            <img src="${item.data}" alt="Historical image ${new Date(item.timestamp).toLocaleDateString()}">
        </div>
    `).join('');
    
    // Add click handlers
    document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => loadHistoryItem(item.dataset.id));
        item.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                loadHistoryItem(item.dataset.id);
            }
        });
    });
}

function loadHistoryItem(id) {
    const history = getHistory();
    const item = history.find(h => h.id.toString() === id.toString());
    if (item) {
        resetStates();
        previewPlaceholder.style.display = 'none';
        imagePreview.src = item.data;
        imagePreview.style.display = 'block';
        imageControls.style.display = 'block';
        currentImageData = item.data;
        extractButton.disabled = false;
    }
}

function clearHistory() {
    localStorage.removeItem('imageHistory');
    updateHistoryUI([]);
    showNotification('History cleared', 'success');
}

// Image Processing
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onload = e => {
            const img = new Image();
            img.src = e.target.result;
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculate new dimensions (max 1600px)
                let width = img.width;
                let height = img.height;
                const maxDimension = 1600;
                
                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = (height / width) * maxDimension;
                        width = maxDimension;
                    } else {
                        width = (width / height) * maxDimension;
                        height = maxDimension;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob(
                    blob => resolve(blob),
                    file.type,
                    0.8 // compression quality
                );
            };
            
            img.onerror = reject;
        };
        
        reader.onerror = reject;
    });
}

// Image Controls
function updateImageFilters() {
    const brightness = brightnessSlider.value;
    const contrast = contrastSlider.value;
    imagePreview.style.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
}

function rotateImage(direction) {
    currentRotation += direction === 'left' ? -90 : 90;
    imagePreview.style.transform = `rotate(${currentRotation}deg)`;
}

function resetImageControls() {
    brightnessSlider.value = 100;
    contrastSlider.value = 100;
    currentRotation = 0;
    imagePreview.style.filter = '';
    imagePreview.style.transform = '';
}

// Event Listeners
themeToggle.addEventListener('click', toggleTheme);
rotateLeftBtn.addEventListener('click', () => rotateImage('left'));
rotateRightBtn.addEventListener('click', () => rotateImage('right'));
brightnessSlider.addEventListener('input', updateImageFilters);
contrastSlider.addEventListener('input', updateImageFilters);
resetImageButton.addEventListener('click', resetImageControls);
clearHistoryButton.addEventListener('click', clearHistory);

// Prevent default drag behaviors
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Highlight drop zone when file is dragged over it
['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, unhighlight, false);
});

function highlight() {
    dropZone.classList.add('dragover');
}

function unhighlight() {
    dropZone.classList.remove('dragover');
}

// Handle dropped files
dropZone.addEventListener('drop', handleDrop, false);
fileInput.addEventListener('change', handleFiles, false);
copyButton.addEventListener('click', copyToClipboard, false);
downloadButton.addEventListener('click', downloadText, false);
clearButton.addEventListener('click', clearResults, false);

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles({ target: { files } });
}

function handleFiles(e) {
    const file = e.target.files ? e.target.files[0] : e.dataTransfer.files[0];
    
    if (!file || !file.type.startsWith('image/')) {
        showNotification('Please select a valid image file.', 'error');
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        showNotification('File size exceeds 5MB limit.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        loadingIndicator.style.display = 'none';
        previewPlaceholder.style.display = 'none';
        imagePreview.src = e.target.result;
        imagePreview.style.display = 'block';
        imageControls.style.display = 'block';
        currentImageData = e.target.result;
        
        // Enable extract button
        extractButton.disabled = false;
        
        // Add to history
        addToHistory(e.target.result);
    };

    reader.onerror = function() {
        showNotification('Error reading file.', 'error');
        previewPlaceholder.style.display = 'block';
        imagePreview.style.display = 'none';
    };

    loadingIndicator.style.display = 'block';
    previewPlaceholder.style.display = 'none';
    reader.readAsDataURL(file);
}

async function extractText(file) {
    if (isProcessing) return;
    
    try {
        isProcessing = true;
        processingContainer.style.display = 'block';
        resultText.value = '';
        
        // Initialize worker
        currentWorker = await createWorker();
        
        // Start processing
        const result = await currentWorker.recognize(file);
        
        // Update result
        resultText.value = result.data.text.trim();
        
        // Cleanup
        await cleanupWorker();
        showSuccess();
        
    } catch (error) {
        handleError(error);
    } finally {
        isProcessing = false;
        processingContainer.style.display = 'none';
    }
}

async function createWorker() {
    try {
        statusText.textContent = 'Initializing Tesseract...';
        const worker = await Tesseract.createWorker();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        return worker;
    } catch (error) {
        throw new Error('Failed to initialize Tesseract');
    }
}

function updateProgress(progress) {
    if (!progressBar || !statusText) return;
    
    const percent = progress.progress * 100;
    progressBar.style.width = `${percent}%`;
    
    let status = 'Initializing...';
    if (progress.status === 'recognizing text') {
        status = `Extracting text (${Math.round(percent)}%)`;
    } else if (progress.status === 'loading tesseract core') {
        status = 'Loading OCR engine...';
    } else if (progress.status === 'loading language traineddata') {
        status = 'Loading language data...';
    }
    
    statusText.textContent = status;
}

async function cancelProcessing() {
    if (!isProcessing) return;
    
    try {
        await cleanupWorker();
        resetProcessingState();
        statusText.textContent = 'Processing cancelled';
    } catch (error) {
        handleError(error);
    }
}

async function cleanupWorker() {
    if (currentWorker) {
        try {
            await currentWorker.terminate();
            currentWorker = null;
        } catch (error) {
            console.error('Error terminating worker:', error);
        }
    }
}

function handleError(error) {
    console.error('OCR Error:', error);
    // Provide more specific error messages based on the error type
    let errorMessage = 'Error extracting text. Make sure the image is clear and contains readable text.';
    
    if (error.message.includes('initialize')) {
        errorMessage = 'Failed to initialize OCR engine. Please check your internet connection and try again.';
    } else if (error.message.includes('load')) {
        errorMessage = 'Failed to load language data. Please check your internet connection and try again.';
    }
    
    showNotification(errorMessage, 'error');
    resetProcessingState();
}

function showSuccess() {
    processingContainer.style.display = 'none';
    showNotification('Text extracted successfully', 'success');
}

function resetProcessingState() {
    isProcessing = false;
    processingContainer.style.display = 'none';
    progressBar.style.width = '0%';
}

function copyToClipboard() {
    if (!resultText.value) {
        showNotification('No text to copy', 'error');
        return;
    }
    
    try {
        resultText.select();
        document.execCommand('copy');
        showNotification('Text copied to clipboard', 'success');
    } catch (error) {
        showNotification('Failed to copy text', 'error');
    }
}

function downloadText() {
    if (!resultText.value) {
        showNotification('No text to download', 'error');
        return;
    }
    
    try {
        const blob = new Blob([resultText.value], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        // Get current date for filename
        const date = new Date().toISOString().slice(0,10);
        a.download = `extracted_text_${date}.txt`;
        a.href = url;
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showNotification('Text downloaded successfully', 'success');
    } catch (error) {
        showNotification('Failed to download text', 'error');
    }
}

function clearResults() {
    if (!resultText.value) {
        showNotification('Nothing to clear', 'error');
        return;
    }
    
    resultText.value = '';
    showNotification('Results cleared', 'success');
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // Add icon based on type
    const icon = document.createElement('span');
    icon.innerHTML = type === 'success' 
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"></polyline></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    
    notification.appendChild(icon);
    notification.appendChild(document.createTextNode(message));
    
    notificationsContainer.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.classList.add('removing');
        setTimeout(() => {
            notificationsContainer.removeChild(notification);
        }, 300);
    }, 3000);
}

function validateFile(file) {
    // Check file type
    if (!ALLOWED_TYPES.includes(file.type)) {
        showError('Invalid file type. Please upload a JPG, PNG, or GIF image.');
        return false;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        showError('File is too large. Maximum size is 5MB.');
        return false;
    }

    return true;
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    dropZone.classList.add('error');
    loadingIndicator.style.display = 'none';
    imagePreview.style.display = 'none';
    previewPlaceholder.style.display = 'block';
    resetProcessingState();
    showNotification(message, 'error');
}

function resetStates() {
    errorMessage.style.display = 'none';
    dropZone.classList.remove('error');
    imagePreview.style.display = 'none';
    loadingIndicator.style.display = 'none';
    previewPlaceholder.style.display = 'block';
    resetProcessingState();
    resultText.value = '';
    currentImageData = null;
    extractButton.disabled = true;
    processingContainer.style.display = 'none';
    
    // Reset image controls
    currentRotation = 0;
    currentBrightness = 100;
    currentContrast = 100;
    updateImageFilters();
}

// Tab switching
uploadTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        
        // Update active tab
        uploadTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update active content
        uploadContents.forEach(content => {
            if (content.dataset.content === target) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
    });
});

// Paste zone click handler
pasteZone.addEventListener('click', () => {
    pasteZone.focus();
    showNotification('Ready to paste image (Ctrl+V)', 'info');
});

// Handle paste events globally
window.addEventListener('paste', (e) => {
    // Only handle paste if the paste zone is focused
    if (document.activeElement !== pasteZone) {
        return;
    }

    e.preventDefault();
    e.stopPropagation();

    const items = e.clipboardData.items;
    let hasImage = false;

    for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
            hasImage = true;
            const blob = item.getAsFile();
            
            // Create a File object from the blob
            const file = new File([blob], "pasted-image.png", { type: blob.type });
            handleFiles({ target: { files: [file] } });
            
            // Switch to preview section
            document.querySelector('[data-tab="upload"]').click();
            break;
        }
    }

    if (!hasImage) {
        showNotification('Please paste an image file', 'error');
    }
});

// Update the upload info text to include paste instructions
const uploadInfo = document.querySelector('.upload-info');
uploadInfo.textContent = 'Supported formats: JPG, PNG, GIF (max 5MB)';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initHistory();
});

// Extract button click handler
extractButton.addEventListener('click', async () => {
    if (!currentImageData || isProcessing) return;
    
    try {
        isProcessing = true;
        extractButton.disabled = true;
        resultText.value = '';
        
        // Show processing section and reset progress
        const processingSection = document.querySelector('.processing-section');
        processingSection.style.display = 'block';
        processingContainer.style.display = 'block';
        progressBar.style.width = '0%';
        statusText.textContent = 'Initializing OCR engine...';
        
        // Initialize worker with detailed progress tracking
        const worker = await Tesseract.createWorker({
            logger: progress => {
                console.log('Progress:', progress); // Debug log
                const percent = progress.progress * 100;
                progressBar.style.width = `${percent}%`;
                
                // Show detailed status messages
                switch(progress.status) {
                    case 'loading tesseract core':
                        statusText.textContent = 'Loading OCR engine... ' + Math.round(percent) + '%';
                        break;
                    case 'loading language traineddata':
                        statusText.textContent = 'Loading language data... ' + Math.round(percent) + '%';
                        break;
                    case 'initializing api':
                        statusText.textContent = 'Preparing image analysis...';
                        break;
                    case 'recognizing text':
                        statusText.textContent = `Extracting text... ${Math.round(percent)}%`;
                        // Show partial results if available
                        if (progress.progress > 0.5 && progress.text) {
                            resultText.value = progress.text.trim();
                        }
                        break;
                    default:
                        statusText.textContent = progress.status;
                }
            }
        });

        statusText.textContent = 'Loading language support...';
        await worker.loadLanguage('eng');
        
        statusText.textContent = 'Initializing text recognition...';
        await worker.initialize('eng');
        
        // Create a new Image object to handle the data URL
        const img = new Image();
        img.src = currentImageData;
        
        // Wait for image to load
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });
        
        // Create canvas to get image data
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        // Apply current rotation and filters
        ctx.translate(canvas.width/2, canvas.height/2);
        ctx.rotate(currentRotation * Math.PI/180);
        ctx.translate(-canvas.width/2, -canvas.height/2);
        ctx.filter = `brightness(${currentBrightness}%) contrast(${currentContrast}%)`;
        ctx.drawImage(img, 0, 0);
        
        // Start processing with canvas
        statusText.textContent = 'Starting text extraction...';
        const result = await worker.recognize(canvas);
        
        // Update final result
        const extractedText = result.data.text.trim();
        resultText.value = extractedText;
        
        // Cleanup
        await worker.terminate();
        
        // Show completion notification with word count
        if (extractedText.length > 0) {
            const wordCount = extractedText.split(/\s+/).filter(word => word.length > 0).length;
            showNotification(`Extracted ${wordCount} words (${extractedText.length} characters)`, 'success');
        } else {
            showNotification('No text was found in the image. Try adjusting the image or using a clearer image.', 'error');
        }
        
    } catch (error) {
        console.error('Extraction error:', error);
        showNotification('Error extracting text. Please try again with a clearer image.', 'error');
    } finally {
        isProcessing = false;
        extractButton.disabled = false;
        const processingSection = document.querySelector('.processing-section');
        processingSection.style.display = 'none';
        processingContainer.style.display = 'none';
        progressBar.style.width = '0%';
        statusText.textContent = 'Ready';
    }
}); 
