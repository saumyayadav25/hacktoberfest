// Initialize the SmartAttendance database
if (typeof SmartAttendance === 'undefined') {
  window.SmartAttendance = {
    registeredFaces: [],
    loadDB: function() {
      try {
        const data = localStorage.getItem('smartAttendanceDB');
        if (data) {
          const parsed = JSON.parse(data);
          this.registeredFaces = parsed.registeredFaces || [];
        }
        return true;
      } catch (e) {
        console.error('Error loading database:', e);
        this.registeredFaces = [];
        return false;
      }
    },
    saveDB: function() {
      try {
        localStorage.setItem('smartAttendanceDB', JSON.stringify({
          registeredFaces: this.registeredFaces
        }));
        return true;
      } catch (e) {
        console.error('Error saving database:', e);
        return false;
      }
    },
    loadModelsUI: async function() {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        return true;
      } catch (e) {
        console.error('Error loading models:', e);
        return false;
      }
    }
  };
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize database
  SmartAttendance.loadDB();
  
  // Form elements
  const form = document.getElementById('registrationForm');
  const nameInput = document.getElementById('userName');
  const idInput = document.getElementById('userIdNumber');
  const fileInput = document.getElementById('idImageInput');
  const img = document.getElementById('idImage');
  const noPreviewText = document.getElementById('noPreviewText');
  const result = document.getElementById('registerResult');
  const regList = document.getElementById('registeredList');
  const submitBtn = document.getElementById('extractBtn');
  const registerBtnText = document.getElementById('registerBtnText');
  const registerSpinner = document.getElementById('registerSpinner');
  const modal = document.getElementById('modal');
  const modalMessage = document.getElementById('modalMessage');
  const modalClose = document.getElementById('modalClose');

  // Show/hide modal
  function showModal(message, isError = false) {
    modalMessage.innerHTML = `
      <div class="d-flex align-items-center">
        <i class="bi ${isError ? 'bi-exclamation-triangle-fill text-danger' : 'bi-check-circle-fill text-success'} me-2"></i>
        <span>${message}</span>
      </div>
    `;
    modal.classList.remove('hidden');
  }

  modalClose.addEventListener('click', () => modal.classList.add('hidden'));

  // Load and convert database
  function loadDBAndConvert() {
    SmartAttendance.loadDB();
    SmartAttendance.registeredFaces.forEach(st => {
      st.descriptor = new Float32Array(st.descriptor);
    });
  }

  // Refresh registered students list
  function refreshList() {
    loadDBAndConvert();
    const arr = SmartAttendance.registeredFaces;
    const totalStudents = arr.length;
    
    // Update the heading to show count
    const heading = document.querySelector('#registeredList').previousElementSibling;
    heading.innerHTML = `Registered Students <span class="badge bg-primary ms-2">${totalStudents}</span>`;
    
    regList.innerHTML = '';
    
    if (!totalStudents) {
      regList.innerHTML = `
        <div class="alert alert-light mb-0" role="alert">
          <i class="bi bi-info-circle me-2"></i>No students registered yet.
        </div>
      `;
      return;
    }
    
    const listGroup = document.createElement('div');
    listGroup.className = 'list-group list-group-flush mb-3';
    
    arr.forEach((st, index) => {
      const item = document.createElement('div');
      item.className = 'list-group-item d-flex justify-content-between align-items-center';
      item.innerHTML = `
        <div class="d-flex align-items-center">
          <span class="badge bg-secondary me-2">${index + 1}</span>
          <div>
            <span class="fw-semibold">${st.name}</span>
            ${st.id ? `<div class="text-muted small">${st.id}</div>` : ''}
            ${st.registeredAt ? `<div class="text-muted small">${new Date(st.registeredAt).toLocaleString()}</div>` : ''}
          </div>
        </div>
        <button class="btn btn-sm btn-outline-secondary" data-bs-toggle="tooltip" title="View details">
          <i class="bi bi-three-dots-vertical"></i>
        </button>
      `;
      listGroup.appendChild(item);
    });
    
    // Add summary card at the bottom
    const summaryCard = `
      <div class="card bg-light mt-3">
        <div class="card-body py-2">
          <div class="d-flex justify-content-between align-items-center">
            <span class="small text-muted">Total Registered:</span>
            <span class="badge bg-primary">${totalStudents} student${totalStudents !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
    `;
    
    regList.appendChild(listGroup);
    regList.insertAdjacentHTML('beforeend', summaryCard);
    
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(regList.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
  }

  // Initialize the page
  refreshList();

  // Handle image preview
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) {
      img.style.display = 'none';
      noPreviewText.style.display = 'block';
      return;
    }
    
    img.onload = () => {
      URL.revokeObjectURL(img.src); // Free up memory
    };
    
    img.src = URL.createObjectURL(file);
    img.style.display = 'block';
    noPreviewText.style.display = 'none';
  });

  // Set loading state
  function setLoading(isLoading) {
    if (isLoading) {
      submitBtn.disabled = true;
      registerSpinner.classList.remove('d-none');
      registerBtnText.textContent = 'Processing...';
    } else {
      submitBtn.disabled = false;
      registerSpinner.classList.add('d-none');
      registerBtnText.textContent = 'Register Student';
    }
  }

  // Show status message
  function showStatus(message, type = 'info') {
    const alertClass = {
      'success': 'alert-success',
      'error': 'alert-danger',
      'warning': 'alert-warning',
      'info': 'alert-info'
    }[type] || 'alert-info';
    
    result.innerHTML = `
      <div class="alert ${alertClass} mb-0" role="alert">
        <i class="bi ${type === 'success' ? 'bi-check-circle' : type === 'error' ? 'bi-exclamation-triangle' : 'bi-info-circle'}-fill me-2"></i>
        ${message}
      </div>
    `;
  }

  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Basic form validation
    if (!form.checkValidity()) {
      e.stopPropagation();
      form.classList.add('was-validated');
      return;
    }
    
    const name = nameInput.value.trim();
    const id = idInput.value.trim();
    
    // Show loading state
    setLoading(true);
    showStatus('Loading face recognition models...', 'info');
    
    try {
      // Load face-api models
      const modelsLoaded = await SmartAttendance.loadModelsUI();
      if (!modelsLoaded) {
        throw new Error('Failed to load face recognition models. Please try again.');
      }
      
      showStatus('Detecting face in the uploaded image...', 'info');
      
      // Detect face in the uploaded image
      const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();
      
      if (!detection) {
        throw new Error('No face detected in the uploaded image. Please upload a clear photo with a visible face.');
      }
      
      loadDBAndConvert();
      
      // Check for duplicate name
      const nameDup = SmartAttendance.registeredFaces.some(st => 
        st.name.toLowerCase() === name.toLowerCase()
      );
      
      if (nameDup) {
        throw new Error(`A student with the name "${name}" is already registered.`);
      }
      
      // Check for duplicate face
      const isDuplicateFace = SmartAttendance.registeredFaces.some(st => 
        faceapi.euclideanDistance(st.descriptor, detection.descriptor) < 0.6
      );
      
      if (isDuplicateFace) {
        throw new Error('This face is already registered in the system.');
      }
      
      // Add new student
      const newStudent = {
        name,
        id: id || null,
        descriptor: Array.from(detection.descriptor),
        registeredAt: new Date().toISOString()
      };
      
      SmartAttendance.registeredFaces.push(newStudent);
      SmartAttendance.saveDB();
      
      // Show success message
      showStatus(`Successfully registered ${name}`, 'success');
      showModal(`<i class="bi bi-check-circle-fill text-success me-2"></i> ${name} has been successfully registered!`, false);
      
      // Reset form and refresh list
      form.reset();
      form.classList.remove('was-validated');
      img.style.display = 'none';
      noPreviewText.style.display = 'block';
      refreshList();
      
    } catch (error) {
      console.error('Registration error:', error);
      showStatus(error.message, 'error');
      showModal(`<i class="bi bi-exclamation-triangle-fill text-danger me-2"></i> ${error.message}`, true);
    } finally {
      setLoading(false);
    }
  });

  // Initialize tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });

  // Initialize popovers
  const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
  popoverTriggerList.map(function (popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl);
  });
});
