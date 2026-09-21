/**
 * ==============================================================================
 * VehicleVision — Client-Side Application Controller
 * ==============================================================================
 * 
 * Manages vehicle multi-image selection, drag-and-drop interactions,
 * client-side validations, preview rendering, and prepare payload contract
 * for future FastAPI backend integration.
 * 
 * Supported Formats: JPG, JPEG, PNG, WEBP
 * Recommended Vehicle Images: 10–12 photos
 * Maximum Allowed: 12 photos
 */

(function () {
  'use strict';

  // ----------------------------------------------------------------------------
  // Configuration & Constants
  // ----------------------------------------------------------------------------
  const CONFIG = {
    MAX_VEHICLE_IMAGES: 12,
    RECOMMENDED_MIN_IMAGES: 10,
    MAX_FILE_SIZE_BYTES: 25 * 1024 * 1024, // 25 MB per file
    ALLOWED_EXTENSIONS: ['jpg', 'jpeg', 'png', 'webp'],
    ALLOWED_MIME_TYPES: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp'
    ]
  };

  // ----------------------------------------------------------------------------
  // Application State
  // ----------------------------------------------------------------------------
  const state = {
    vehicleImages: [],
    backgroundImage: null,
    jobId: null
  };

  // ----------------------------------------------------------------------------
  // DOM Elements Cache
  // ----------------------------------------------------------------------------
  const elements = {
    // Vehicle Upload
    vehicleFileInput: document.getElementById('vehicleFileInput'),
    vehicleDropzone: document.getElementById('vehicleDropzone'),
    browseVehicleBtn: document.getElementById('browseVehicleBtn'),
    vehicleCounterBadge: document.getElementById('vehicleCounterBadge'),
    selectedCountText: document.getElementById('selectedCountText'),
    validationNotice: document.getElementById('validationNotice'),
    previewArea: document.getElementById('previewArea'),
    previewGrid: document.getElementById('previewGrid'),
    previewCountDisplay: document.getElementById('previewCountDisplay'),
    clearAllVehiclesBtn: document.getElementById('clearAllVehiclesBtn'),
    analyzeBtn: document.getElementById('analyzeBtn'),
    actionRecommendation: document.getElementById('actionRecommendation'),

    // Background Overlay Upload
    bgFileInput: document.getElementById('bgFileInput'),
    bgDropzone: document.getElementById('bgDropzone'),
    browseBgBtn: document.getElementById('browseBgBtn'),
    bgPreviewCard: document.getElementById('bgPreviewCard'),
    bgPreviewImg: document.getElementById('bgPreviewImg'),
    bgFileName: document.getElementById('bgFileName'),
    bgFileSize: document.getElementById('bgFileSize'),
    removeBgBtn: document.getElementById('removeBgBtn'),

    // Feedback
    toastContainer: document.getElementById('toastContainer')
  };

  // ----------------------------------------------------------------------------
  // Helper Functions
  // ----------------------------------------------------------------------------

  /**
   * Generates a unique client-side identifier for tracked files.
   */
  function generateUniqueId() {
    return 'img_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  }

  /**
   * Formats raw bytes into a human-readable string (KB, MB).
   */
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Validates if a file has an approved image type and size.
   */
  function validateFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const isValidExt = CONFIG.ALLOWED_EXTENSIONS.includes(ext);
    const isValidMime = !file.type || CONFIG.ALLOWED_MIME_TYPES.includes(file.type.toLowerCase());

    if (!isValidExt && !isValidMime) {
      return { valid: false, error: `Unsupported image format: "${file.name}". Please use JPG, PNG, or WEBP.` };
    }

    if (file.size > CONFIG.MAX_FILE_SIZE_BYTES) {
      return { valid: false, error: `File "${file.name}" exceeds the maximum allowed size of 25MB.` };
    }

    return { valid: true };
  }

  /**
   * Displays a lightweight toast notification on the screen.
   */
  function showToast(message, type = 'info', durationMs = 4000) {
    if (!elements.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');

    // SVGs for toast types
    let iconSvg = '';
    if (type === 'error') {
      iconSvg = '<svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    } else if (type === 'warning') {
      iconSvg = '<svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    } else {
      iconSvg = '<svg class="toast-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    }

    toast.innerHTML = `
      ${iconSvg}
      <div class="toast-message">${escapeHtml(message)}</div>
      <button type="button" class="toast-close" aria-label="Dismiss notification">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => removeToast(toast));

    elements.toastContainer.appendChild(toast);

    if (durationMs > 0) {
      setTimeout(() => removeToast(toast), durationMs);
    }
  }

  function removeToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px) scale(0.95)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 200);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ----------------------------------------------------------------------------
  // Vehicle Images Management
  // ----------------------------------------------------------------------------

  /**
   * Processes a list of selected or dropped files for vehicle analysis.
   */
  function handleVehicleFiles(fileList) {
    if (!fileList || fileList.length === 0) return;

    const incomingFiles = Array.from(fileList);
    let addedCount = 0;
    let formatErrors = 0;
    let duplicates = 0;
    let limitReached = false;

    for (const file of incomingFiles) {
      // Check maximum limit
      if (state.vehicleImages.length >= CONFIG.MAX_VEHICLE_IMAGES) {
        limitReached = true;
        break;
      }

      // Check validation
      const validation = validateFile(file);
      if (!validation.valid) {
        formatErrors++;
        continue;
      }

      // Check duplicates (by name, size, lastModified)
      const isDuplicate = state.vehicleImages.some(item =>
        item.file.name === file.name &&
        item.file.size === file.size &&
        item.file.lastModified === file.lastModified
      );

      if (isDuplicate) {
        duplicates++;
        continue;
      }

      // Create preview object URL
      const previewUrl = URL.createObjectURL(file);
      state.vehicleImages.push({
        id: generateUniqueId(),
        file: file,
        previewUrl: previewUrl
      });
      addedCount++;
    }

    // Feedback for limits & errors
    if (limitReached) {
      showToast('Maximum 12 vehicle images allowed.', 'warning');
    }
    if (formatErrors > 0) {
      showToast('Unsupported image format. Allowed formats: JPG, PNG, WEBP.', 'error');
    }
    if (duplicates > 0) {
      showToast(`${duplicates} duplicate image(s) skipped.`, 'info');
    }

    // Update UI components
    updateVehicleUI();
  }

  /**
   * Removes a single image by its unique ID.
   */
  function removeVehicleImage(id) {
    const index = state.vehicleImages.findIndex(img => img.id === id);
    if (index !== -1) {
      const removed = state.vehicleImages.splice(index, 1)[0];
      if (removed.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      updateVehicleUI();
    }
  }

  /**
   * Clears all selected vehicle images.
   */
  function clearAllVehicleImages() {
    state.vehicleImages.forEach(img => {
      if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
    });
    state.vehicleImages = [];
    if (elements.vehicleFileInput) elements.vehicleFileInput.value = '';
    updateVehicleUI();
  }

  /**
   * Renders the preview grid and updates counters, notices, and button states.
   */
  function updateVehicleUI() {
    const count = state.vehicleImages.length;

    // 1. Update Counter Badges
    elements.selectedCountText.textContent = count;
    elements.previewCountDisplay.textContent = `${count} / ${CONFIG.MAX_VEHICLE_IMAGES} images`;

    // 2. Toggle Preview Container
    if (count > 0) {
      elements.previewArea.style.display = 'block';
    } else {
      elements.previewArea.style.display = 'none';
    }

    // 3. Render Preview Cards
    renderPreviewGrid();

    // 4. Update Validation Notices & Recommendations
    updateValidationNotice(count);

    // 5. Update Analyze Button State
    updateAnalyzeButton(count);
  }

  /**
   * Reconstructs the grid of image preview cards.
   */
  function renderPreviewGrid() {
    elements.previewGrid.innerHTML = '';

    state.vehicleImages.forEach((item, index) => {
      const paddedIndex = String(index + 1).padStart(2, '0');
      const card = document.createElement('div');
      card.className = 'image-card';
      card.setAttribute('role', 'listitem');

      card.innerHTML = `
        <div class="image-thumbnail-wrap">
          <img 
            src="${item.previewUrl}" 
            alt="Vehicle angle ${paddedIndex}" 
            class="image-thumbnail"
            loading="lazy"
          >
        </div>
        <div class="image-card-body">
          <div class="image-meta">
            <span class="image-label">Image ${paddedIndex}</span>
            <span class="image-filename" title="${escapeHtml(item.file.name)}">
              ${escapeHtml(item.file.name)}
            </span>
            <span class="image-filesize">${formatBytes(item.file.size)}</span>
          </div>
          <button 
            type="button" 
            class="btn-card-remove" 
            data-id="${item.id}"
            aria-label="Remove ${escapeHtml(item.file.name)}"
            title="Remove image"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      `;

      const removeBtn = card.querySelector('.btn-card-remove');
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeVehicleImage(item.id);
      });

      elements.previewGrid.appendChild(card);
    });
  }

  /**
   * Updates non-blocking alerts according to requirement specifications.
   */
  function updateValidationNotice(count) {
    elements.validationNotice.innerHTML = '';

    if (count === 0) {
      elements.actionRecommendation.textContent = 'Upload 10–12 photos of the same vehicle for comprehensive analysis.';
      return;
    }

    if (count < CONFIG.RECOMMENDED_MIN_IMAGES) {
      // Non-blocking warning when fewer than 10 images
      const box = document.createElement('div');
      box.className = 'notice-box warning';
      box.innerHTML = `
        <svg class="notice-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span><strong>Recommended:</strong> upload 10–12 images for better vehicle analysis. (${count} currently selected)</span>
      `;
      elements.validationNotice.appendChild(box);
      elements.actionRecommendation.textContent = `Recommended: 10–12 images. You have selected ${count}.`;
    } else if (count >= CONFIG.RECOMMENDED_MIN_IMAGES && count <= CONFIG.MAX_VEHICLE_IMAGES) {
      // Optimal range
      const box = document.createElement('div');
      box.className = 'notice-box info';
      box.innerHTML = `
        <svg class="notice-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <path d="m9 12 2 2 4-4"/>
        </svg>
        <span>Optimal image count reached (${count} / ${CONFIG.MAX_VEHICLE_IMAGES}). Ready for viewpoint identification &amp; showcase generation.</span>
      `;
      elements.validationNotice.appendChild(box);
      elements.actionRecommendation.textContent = `Optimal selection: ${count} vehicle images ready for local analysis.`;
    }
  }

  /**
   * Updates analyze button disabled/enabled state.
   */
  function updateAnalyzeButton(count) {
    if (count > 0) {
      elements.analyzeBtn.disabled = false;
      elements.analyzeBtn.removeAttribute('aria-disabled');
    } else {
      elements.analyzeBtn.disabled = true;
      elements.analyzeBtn.setAttribute('aria-disabled', 'true');
    }
  }

  // ----------------------------------------------------------------------------
  // Overlay Background Image Management
  // ----------------------------------------------------------------------------

  function handleBackgroundFile(file) {
    if (!file) return;

    const validation = validateFile(file);
    if (!validation.valid) {
      showToast(validation.error, 'error');
      return;
    }

    // Clean previous preview
    if (state.backgroundImage && state.backgroundImage.previewUrl) {
      URL.revokeObjectURL(state.backgroundImage.previewUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    state.backgroundImage = {
      file: file,
      previewUrl: previewUrl
    };

    // Render Preview
    elements.bgPreviewImg.src = previewUrl;
    elements.bgFileName.textContent = file.name;
    elements.bgFileSize.textContent = formatBytes(file.size);
    elements.bgPreviewCard.style.display = 'flex';
    elements.bgDropzone.style.display = 'none';

    showToast('Background overlay image loaded.', 'success');
  }

  function removeBackgroundImage() {
    if (state.backgroundImage && state.backgroundImage.previewUrl) {
      URL.revokeObjectURL(state.backgroundImage.previewUrl);
    }
    state.backgroundImage = null;

    if (elements.bgFileInput) elements.bgFileInput.value = '';
    elements.bgPreviewCard.style.display = 'none';
    elements.bgDropzone.style.display = 'block';
  }

  // ----------------------------------------------------------------------------
  // Drag and Drop Utilities
  // ----------------------------------------------------------------------------

  function setupDropzone(dropzoneEl, onFilesReceived) {
    if (!dropzoneEl) return;

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzoneEl.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzoneEl.classList.add('drag-active');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzoneEl.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzoneEl.classList.remove('drag-active');
      });
    });

    dropzoneEl.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        onFilesReceived(dt.files);
      }
    });

    // Keyboard accessibility: Enter or Space triggers file picker
    dropzoneEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        dropzoneEl.click();
      }
    });
  }

  // ----------------------------------------------------------------------------
  // 6. ANALYZE HANDLER (FastAPI Upload Integration)
  // ----------------------------------------------------------------------------

  /**
   * Triggered when the user clicks "Analyze Vehicle".
   * Sends selected vehicle images and optional background to /api/upload.
   */
  async function handleAnalyze() {
    if (state.vehicleImages.length === 0) {
      showToast('Please select at least 1 vehicle image to analyze.', 'warning');
      return;
    }

    if (state.vehicleImages.length < CONFIG.RECOMMENDED_MIN_IMAGES) {
      showToast('Please upload at least 10 vehicle images for analysis.', 'warning');
      return;
    }

    if (state.vehicleImages.length > CONFIG.MAX_VEHICLE_IMAGES) {
      showToast('Maximum 12 vehicle images allowed.', 'warning');
      return;
    }

    const formData = new FormData();

    // Add vehicle images under field name 'files'
    state.vehicleImages.forEach((item) => {
      formData.append('files', item.file, item.file.name);
    });

    // Add optional background image under field name 'background'
    if (state.backgroundImage) {
      formData.append(
        'background',
        state.backgroundImage.file,
        state.backgroundImage.file.name
      );
    }

    // Disable button and show upload state
    const analyzeBtn = elements.analyzeBtn;
    const originalButtonHtml = analyzeBtn ? analyzeBtn.innerHTML : 'Analyze Vehicle';

    if (analyzeBtn) {
      analyzeBtn.disabled = true;
      analyzeBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="status-pulse">
          <circle cx="12" cy="12" r="10"/>
        </svg>
        <span>Uploading...</span>
      `;
    }

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json().catch(() => null);
      if (result && result.job_id) {
        state.jobId = result.job_id;
      }

      if (response.ok && result) {
        console.log('[VehicleVision] Upload successful:', result);
        const bgInfo = result.background ? ' + 1 background image' : '';
        showToast(
          `${result.count} vehicle images${bgInfo} uploaded successfully.`,
          'success',
          4000
        );
      } else {
        const errorDetail = (result && result.detail)
          ? (typeof result.detail === 'string' ? result.detail : JSON.stringify(result.detail))
          : `Upload failed (Status ${response.status})`;
        showToast(errorDetail, 'error', 5000);
      }
    } catch (error) {
      console.error('[VehicleVision] Network / upload error:', error);
      showToast('Network error: Unable to connect to server.', 'error', 4000);
    } finally {
      if (analyzeBtn) {
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = originalButtonHtml;
      }
    }
  }

  // ----------------------------------------------------------------------------
  // Event Listeners Initialization
  // ----------------------------------------------------------------------------
  function init() {
    // --- Vehicle Upload Events ---
    if (elements.browseVehicleBtn && elements.vehicleFileInput) {
      elements.browseVehicleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        elements.vehicleFileInput.click();
      });
    }

    if (elements.vehicleDropzone && elements.vehicleFileInput) {
      elements.vehicleDropzone.addEventListener('click', () => {
        elements.vehicleFileInput.click();
      });
      setupDropzone(elements.vehicleDropzone, handleVehicleFiles);
    }

    if (elements.vehicleFileInput) {
      elements.vehicleFileInput.addEventListener('change', (e) => {
        handleVehicleFiles(e.target.files);
        // Reset input value so re-selecting the exact same files triggers change event
        e.target.value = '';
      });
    }

    if (elements.clearAllVehiclesBtn) {
      elements.clearAllVehiclesBtn.addEventListener('click', clearAllVehicleImages);
    }

    // --- Background Overlay Upload Events ---
    if (elements.browseBgBtn && elements.bgFileInput) {
      elements.browseBgBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        elements.bgFileInput.click();
      });
    }

    if (elements.bgDropzone && elements.bgFileInput) {
      elements.bgDropzone.addEventListener('click', () => {
        elements.bgFileInput.click();
      });
      setupDropzone(elements.bgDropzone, (files) => {
        if (files && files[0]) handleBackgroundFile(files[0]);
      });
    }

    if (elements.bgFileInput) {
      elements.bgFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleBackgroundFile(e.target.files[0]);
        }
        e.target.value = '';
      });
    }

    if (elements.removeBgBtn) {
      elements.removeBgBtn.addEventListener('click', removeBackgroundImage);
    }

    // --- Primary Action ---
    if (elements.analyzeBtn) {
      elements.analyzeBtn.addEventListener('click', handleAnalyze);
    }

    console.log('[VehicleVision Frontend] Initialized successfully. Offline-ready UI active.');
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
