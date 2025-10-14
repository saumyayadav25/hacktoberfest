document.addEventListener('DOMContentLoaded', () => {
  // Form elements
  const registrationForm = document.getElementById('registrationForm');
  const nameInput = document.getElementById('userName');
  const idInput = document.getElementById('userIdNumber');
  const fileInput = document.getElementById('idImageInput');
  const img = document.getElementById('idImage');
  const result = document.getElementById('registerResult');
  const regList = document.getElementById('registeredList');
  const modal = document.getElementById('modal');
  const modalMessage = document.getElementById('modalMessage');
  const modalClose = document.getElementById('modalClose');
  const searchInput = document.getElementById('searchInput');
  const studentCount = document.getElementById('studentCount');

  // Store student photos
  const studentPhotos = new Map();

  // Show modal function
  function showModal(msg) { 
    modalMessage.innerHTML = msg; 
    modal.classList.remove('hidden'); 
  }
  
  // Close modal handler
  modalClose.addEventListener('click', () => modal.classList.add('hidden'));

  // Load and convert face descriptors from localStorage
  function loadDBAndConvert() {
    SmartAttendance.loadDB();
    SmartAttendance.registeredFaces.forEach(st => {
      st.descriptor = new Float32Array(st.descriptor);
      // Restore photo if available
      if (st.photoData) {
        studentPhotos.set(st.id, st.photoData);
      }
    });
  }

  // Format date
  function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Refresh the student list
  function refreshList() {
    loadDBAndConvert();
    const students = SmartAttendance.registeredFaces;
    
    // Clear existing rows
    regList.innerHTML = '';
    
    if (!students.length) {
      regList.innerHTML = `
        <tr>
          <td colspan="4" class="text-center py-4">No students registered yet</td>
        </tr>`;
      studentCount.textContent = '0';
      return;
    }

    // Add each student to the table
    students.forEach((student, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="align-middle">
          <img src="${student.photoData || 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22%236c757d%22%3E%3Cpath%20d%3D%22M12%2012a5%205%200%20100-10%205%205%200%20000%2010zm0%201.5c-5.5%200-10%203.5-10%207.5h20c0-4-4.5-7.5-10-7.5z%22%2F%3E%3C%2Fsvg%3E'}" 
               class="rounded-circle" width="40" height="40" alt="${student.name}" 
               style="object-fit: cover;">
        </td>
        <td class="align-middle">
          <div class="fw-semibold">${student.name}</div>
          <small class="text-muted">${formatDate(student.registeredAt || new Date())}</small>
        </td>
        <td class="align-middle">${student.id || 'N/A'}</td>
        <td class="align-middle">
          <button class="btn btn-sm btn-outline-danger delete-student" data-id="${student.id || index}">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      `;
      regList.appendChild(row);
    });

    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-student').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        if (confirm('Are you sure you want to delete this student?')) {
          deleteStudent(id);
        }
      });
    });

    // Update student count
    studentCount.textContent = students.length;
  }

  // Delete a student
  function deleteStudent(id) {
    SmartAttendance.registeredFaces = SmartAttendance.registeredFaces.filter(
      (student, index) => (student.id || index.toString()) !== id
    );
    studentPhotos.delete(id);
    SmartAttendance.saveDB();
    refreshList();
    showModal('Student deleted successfully');
  }

  // Search functionality
  function filterStudents(query) {
    const rows = regList.getElementsByTagName('tr');
    for (const row of rows) {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(query.toLowerCase()) ? '' : 'none';
    }
  }

  // File input change handler
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      img.src = event.target.result;
      img.classList.remove('d-none');
    };
    reader.readAsDataURL(file);
  });

  // Form submission handler
  registrationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!registrationForm.checkValidity()) {
      e.stopPropagation();
      registrationForm.classList.add('was-validated');
      return;
    }

    const name = nameInput.value.trim();
    const id = idInput.value.trim();
    const file = fileInput.files[0];
    
    if (!file) {
      result.textContent = 'Please select an image file';
      result.className = 'text-danger';
      return;
    }

    result.textContent = 'Loading models...';
    result.className = 'text-info';
    
    try {
      // Load face-api models
      const ok = await SmartAttendance.loadModelsUI();
      if (!ok) {
        result.textContent = 'Failed to load face recognition models';
        result.className = 'text-danger';
        return;
      }

      result.textContent = 'Detecting face...';
      
      // Detect face in the image
      const detection = await faceapi.detectSingleFace(
        img, 
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks().withFaceDescriptor();
      
      if (!detection) {
        result.textContent = 'No face detected in the image. Please try another photo.';
        result.className = 'text-danger';
        return;
      }

      loadDBAndConvert();

      // Check for duplicate name
      const nameExists = SmartAttendance.registeredFaces.some(
        st => st.name.toLowerCase() === name.toLowerCase()
      );
      
      if (nameExists) {
        showModal('A student with this name is already registered');
        result.textContent = 'Registration failed';
        result.className = 'text-danger';
        return;
      }

      // Check for duplicate face
      const isDuplicateFace = SmartAttendance.registeredFaces.some(st => {
        return faceapi.euclideanDistance(st.descriptor, detection.descriptor) < 0.6;
      });
      
      if (isDuplicateFace) {
        showModal('This face is already registered');
        result.textContent = 'Registration failed';
        result.className = 'text-danger';
        return;
      }

      // Read image as data URL for storage
      const photoData = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });

      // Add new student
      const newStudent = {
        name,
        id,
        descriptor: Array.from(detection.descriptor),
        photoData,
        registeredAt: new Date().toISOString()
      };

      SmartAttendance.registeredFaces.push(newStudent);
      studentPhotos.set(id, photoData);
      SmartAttendance.saveDB();

      // Reset form
      registrationForm.reset();
      img.src = '';
      img.classList.add('d-none');
      registrationForm.classList.remove('was-validated');
      
      // Show success message
      result.textContent = `Successfully registered ${name}`;
      result.className = 'text-success';
      showModal(`${name} has been registered successfully!`);
      
      // Refresh the student list
      refreshList();
      
    } catch (error) {
      console.error('Registration error:', error);
      result.textContent = 'An error occurred during registration';
      result.className = 'text-danger';
    }
  });

  // Search input handler
  searchInput.addEventListener('input', (e) => {
    filterStudents(e.target.value);
  });

  // Initialize the student list
  refreshList();
});

// Add custom validation for enrollment number
const enrollmentInput = document.getElementById('userIdNumber');
if (enrollmentInput) {
  enrollmentInput.addEventListener('input', function() {
    if (this.validity.patternMismatch) {
      this.setCustomValidity('Please enter a valid enrollment number (e.g., 22BCS1234)');
    } else {
      this.setCustomValidity('');
    }
  });
}
