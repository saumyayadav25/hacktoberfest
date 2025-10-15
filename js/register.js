document.addEventListener('DOMContentLoaded', () => {
  // Form elements
  const form = document.getElementById('registrationForm');
  const nameInput = document.getElementById('userName');
  const idInput = document.getElementById('userIdNumber');
  const fileInput = document.getElementById('idImageInput');
  const img = document.getElementById('idImage');
  const result = document.getElementById('registerResult');
  const registeredList = document.getElementById('registeredList');
  const noStudents = document.getElementById('noStudents');
  const searchInput = document.getElementById('searchStudents');
  const resetBtn = document.getElementById('resetBtn');
  const registerBtn = document.getElementById('extractBtn');
  const registerSpinner = document.getElementById('registerSpinner');
  const registerBtnText = document.getElementById('registerBtnText');
  const modal = document.getElementById('modal');
  const modalMessage = document.getElementById('modalMessage');
  const modalClose = document.getElementById('modalClose');
  const imagePreviewContainer = document.getElementById('imagePreviewContainer');

  // Show modal with message
  function showModal(msg, type = 'info') {
    modalMessage.innerHTML = msg;
    modal.className = `modal ${type}`;
    modal.classList.remove('hidden');
  }

  // Close modal
  modalClose.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
    }
  });

  // Show result message
  function showResult(message, type = 'success') {
    result.textContent = message;
    result.className = `alert alert-${type} mt-3 mb-0`;
    result.classList.remove('d-none');
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
      setTimeout(() => {
        result.classList.add('d-none');
      }, 5000);
    }
  }

  // Toggle loading state
  function setLoading(isLoading) {
    if (isLoading) {
      registerBtn.disabled = true;
      registerSpinner.classList.remove('d-none');
      registerBtnText.textContent = 'Processing...';
    } else {
      registerBtn.disabled = false;
      registerSpinner.classList.add('d-none');
      registerBtnText.textContent = 'Register Student';
    }
  }

  // Load and convert database
  function loadDBAndConvert() {
    SmartAttendance.loadDB();
    SmartAttendance.registeredFaces.forEach(st => {
      st.descriptor = new Float32Array(st.descriptor);
    });
  }

  // Format date
  function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  }

  // Refresh registered students list
  function refreshList(searchQuery = '') {
    loadDBAndConvert();
    const students = SmartAttendance.registeredFaces;
    
    // Filter students based on search query
    const filteredStudents = searchQuery 
      ? students.filter(st => 
          st.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
          (st.id && st.id.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : students;

    // Clear current list
    registeredList.innerHTML = '';
    
    // Show/hide no students message
    if (filteredStudents.length === 0) {
      noStudents.classList.remove('d-none');
      registeredList.closest('.table-responsive').classList.add('d-none');
    } else {
      noStudents.classList.add('d-none');
      registeredList.closest('.table-responsive').classList.remove('d-none');
      
      // Add students to the table
      filteredStudents.forEach((student, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><img src="${student.photo || 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%2250%22%20height%3D%2250%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%20100%22%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2240%22%20r%3D%2220%22%2F%3E%3Cpath%20d%3D%22M30 90c0-11 9-20 20-20h40c11 0 20 9 20 20H30z%22%2F%3E%3C%2Fsvg%3E'}" 
                        alt="${student.name}" class="rounded-circle" width="40" height="40"></td>
          <td class="fw-semibold">${student.name}</td>
          <td>${student.id || 'N/A'}</td>
          <td>
            <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${index}">
              <i class="bi bi-trash"></i> Delete
            </button>
          </td>
        `;
        registeredList.appendChild(row);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const index = parseInt(e.target.closest('button').dataset.id);
          deleteStudent(index);
        });
      });
    }
  }

  // Delete a student
  function deleteStudent(index) {
    if (confirm('Are you sure you want to delete this student? This action cannot be undone.')) {
      SmartAttendance.registeredFaces.splice(index, 1);
      SmartAttendance.saveDB();
      showResult('Student deleted successfully');
      refreshList(searchInput.value);
    }
  }

  // Handle file input change
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.match('image.*')) {
      showResult('Please select a valid image file (JPEG, PNG, etc.)', 'danger');
      fileInput.value = '';
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showResult('Image size should be less than 5MB', 'danger');
      fileInput.value = '';
      return;
    }
    
    // Show image preview
    const reader = new FileReader();
    reader.onload = (event) => {
      img.src = event.target.result;
      imagePreviewContainer.style.display = 'block';
    };
    reader.readAsDataURL(file);
  });

  // Handle form submission
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
    const file = fileInput.files[0];
    
    setLoading(true);
    
    try {
      // Load face-api.js models
      showResult('Loading face recognition models...', 'info');
      const modelsLoaded = await SmartAttendance.loadModelsUI();
      
      if (!modelsLoaded) {
        throw new Error('Failed to load face recognition models');
      }
      
      // Detect face in the uploaded image
      showResult('Detecting face in the image...', 'info');
      const detection = await faceapi.detectSingleFace(
        img,
        new faceapi.TinyFaceDetectorOptions()
      )
      .withFaceLandmarks()
      .withFaceDescriptor();
      
      if (!detection) {
        throw new Error('No face detected in the image. Please upload a clear photo of the student\'s face.');
      }
      
      loadDBAndConvert();
      
      // Check for duplicate name
      const nameDup = SmartAttendance.registeredFaces.some(st => 
        st.name.toLowerCase() === name.toLowerCase()
      );
      
      if (nameDup) {
        throw new Error('A student with this name is already registered.');
      }
      
      // Check for duplicate enrollment number if provided
      if (id) {
        const idDup = SmartAttendance.registeredFaces.some(st => 
          st.id && st.id.toLowerCase() === id.toLowerCase()
        );
        
        if (idDup) {
          throw new Error('A student with this enrollment number is already registered.');
        }
      }
      
      // Check for duplicate face
      const isDuplicateFace = SmartAttendance.registeredFaces.some(st => {
        return faceapi.euclideanDistance(st.descriptor, detection.descriptor) < 0.6;
      });
      
      if (isDuplicateFace) {
        throw new Error('This face is already registered with another student.');
      }
      
      // Read the image as data URL for preview
      const reader = new FileReader();
      const photoPromise = new Promise((resolve) => {
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
      const photo = await photoPromise;
      
      // Add the new student
      const newStudent = {
        name,
        id: id || null,
        descriptor: Array.from(detection.descriptor),
        photo,
        registeredAt: new Date().toISOString()
      };
      
      SmartAttendance.registeredFaces.push(newStudent);
      SmartAttendance.saveDB();
      
      // Show success message and reset form
      showResult(`${name} has been registered successfully!`, 'success');
      form.reset();
      form.classList.remove('was-validated');
      imagePreviewContainer.style.display = 'none';
      
      // Show success modal
      showModal(`
        <div class="text-center">
          <i class="bi bi-check-circle-fill text-success mb-3" style="font-size: 3rem;"></i>
          <h4>Registration Successful!</h4>
          <p>${name} has been registered successfully.</p>
        </div>
      `, 'success');
      
      // Refresh the student list
      refreshList(searchInput.value);
      
    } catch (error) {
      console.error('Registration error:', error);
      showResult(error.message || 'An error occurred during registration. Please try again.', 'danger');
    } finally {
      setLoading(false);
    }
  });
  
  // Reset form
  resetBtn.addEventListener('click', () => {
    form.reset();
    form.classList.remove('was-validated');
    imagePreviewContainer.style.display = 'none';
    result.classList.add('d-none');
  });
  
  // Search functionality
  searchInput.addEventListener('input', (e) => {
    refreshList(e.target.value);
  });
  
  // Initialize the page
  refreshList();
});
