
// Fixed version of register.js with comprehensive improvements

document.addEventListener('DOMContentLoaded', () => {
    const nameInput = document.getElementById('userName');
    const idInput = document.getElementById('userIdNumber');
    const fileInput = document.getElementById('idImageInput');
    const img = document.getElementById('idImage');
    const result = document.getElementById('registerResult');
    const regList = document.getElementById('registeredList');
    const btn = document.getElementById('extractBtn');
    const modal = document.getElementById('modal');
    const modalMessage = document.getElementById('modalMessage');
    const modalClose = document.getElementById('modalClose');

    // State management
    let isProcessing = false;
    let currentImageUrl = null;

    // UI Helper functions
    const UI = {
        showModal: (message, type = 'info') => {
            modalMessage.textContent = message;
            modal.classList.remove('hidden');
            modal.setAttribute('data-type', type);
        },

        hideModal: () => {
            modal.classList.add('hidden');
        },

        showResult: (message, type = 'info') => {
            result.textContent = message;
            result.className = `result ${type}`;
            result.setAttribute('aria-live', 'polite');
        },

        showLoading: (message) => {
            UI.showResult(message, 'loading');
            btn.disabled = true;
            btn.textContent = 'Processing...';
        },

        hideLoading: () => {
            btn.disabled = false;
            btn.textContent = 'Register Student';
        },

        updateProgress: (percentage) => {
            // Could add a progress bar here
            console.log(`Progress: ${percentage}%`);
        }
    };

    // Input validation with real-time feedback
    const Validation = {
        validateName: (name) => {
            if (!SmartAttendance.Utils.validateName(name)) {
                return {
                    valid: false,
                    message: 'Name must be 2-50 characters long and contain only letters, spaces, hyphens, and apostrophes'
                };
            }
            return { valid: true };
        },

        validateId: (id) => {
            if (!SmartAttendance.Utils.validateId(id)) {
                return {
                    valid: false,
                    message: 'ID must be alphanumeric and up to 20 characters'
                };
            }
            return { valid: true };
        },

        validateFile: (file) => {
            if (!file) {
                return { valid: false, message: 'Please select an image file' };
            }

            // Check file type
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
                return { 
                    valid: false, 
                    message: 'Please select a valid image file (JPEG, PNG, or WebP)' 
                };
            }

            // Check file size (max 5MB)
            const maxSize = 5 * 1024 * 1024;
            if (file.size > maxSize) {
                return { 
                    valid: false, 
                    message: 'Image file size must be less than 5MB' 
                };
            }

            return { valid: true };
        }
    };

    // Enhanced registration process
    const Registration = {
        checkDuplicateName: (name) => {
            SmartAttendance.Database.load();
            return SmartAttendance.registeredFaces.some(student => 
                student.name.toLowerCase().trim() === name.toLowerCase().trim()
            );
        },

        processRegistration: async (name, id, file) => {
            SmartAttendance.PerformanceMonitor.start('registration');

            try {
                // Load models with progress feedback
                UI.showLoading('Loading AI models...');
                UI.updateProgress(10);

                const modelResult = await SmartAttendance.ModelLoader.load();
                if (!modelResult.success) {
                    throw new SmartAttendanceError('Failed to load models', 'MODEL_LOAD_ERROR', {
                        details: modelResult.error
                    });
                }

                UI.updateProgress(30);
                UI.showLoading('Processing image...');

                // Detect face with enhanced options
                const detection = await faceapi
                    .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({
                        inputSize: 416,
                        scoreThreshold: 0.3
                    }))
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                UI.updateProgress(60);

                if (!detection) {
                    throw new SmartAttendanceError(
                        'No face detected in the image. Please ensure the photo shows a clear, frontal view of the face.',
                        'NO_FACE_DETECTED'
                    );
                }

                // Validate face quality
                const faceSize = detection.detection.box.width * detection.detection.box.height;
                if (faceSize < SmartAttendance.CONFIG.MIN_FACE_SIZE) {
                    throw new SmartAttendanceError(
                        'Face in image is too small. Please use a higher resolution image.',
                        'FACE_TOO_SMALL'
                    );
                }

                UI.updateProgress(80);
                UI.showLoading('Checking for duplicates...');

                // Reload database and check for duplicates
                SmartAttendance.Database.load();

                // Check duplicate name
                if (Registration.checkDuplicateName(name)) {
                    throw new SmartAttendanceError(
                        'A student with this name is already registered.',
                        'DUPLICATE_NAME'
                    );
                }

                // Check duplicate face
                if (SmartAttendance.FaceRecognition.isDuplicateFace(detection.descriptor)) {
                    throw new SmartAttendanceError(
                        'This face is already registered in the system.',
                        'DUPLICATE_FACE'
                    );
                }

                UI.updateProgress(90);
                UI.showLoading('Saving registration...');

                // Create new student record
                const newStudent = {
                    name: SmartAttendance.Utils.sanitizeInput(name.trim()),
                    id: SmartAttendance.Utils.sanitizeInput((id || '').trim()),
                    descriptor: Array.from(detection.descriptor),
                    registrationDate: new Date().toISOString(),
                    confidence: detection.detection.score
                };

                // Add to database
                SmartAttendance.registeredFaces.push(newStudent);
                const saveResult = SmartAttendance.Database.save();

                if (!saveResult.success) {
                    throw new SmartAttendanceError(
                        'Failed to save student registration.',
                        'SAVE_ERROR',
                        { details: saveResult.error }
                    );
                }

                UI.updateProgress(100);
                SmartAttendance.PerformanceMonitor.end('registration');

                return {
                    success: true,
                    student: newStudent,
                    performance: SmartAttendance.PerformanceMonitor.metrics.registration
                };

            } catch (error) {
                SmartAttendance.PerformanceMonitor.end('registration');
                console.error('Registration error:', error);
                throw error;
            }
        }
    };

    // UI Management
    const UIManager = {
        refreshStudentList: () => {
            SmartAttendance.Database.load();
            const students = SmartAttendance.registeredFaces;

            regList.innerHTML = '';

            if (!students.length) {
                regList.innerHTML = '<div class="empty-state">No students registered yet</div>';
                return;
            }

            students.forEach((student, index) => {
                const item = document.createElement('div');
                item.className = 'student-item';
                item.innerHTML = `
                    <div class="student-info">
                        <span class="student-name">${student.name}</span>
                        ${student.id ? `<span class="student-id">(${student.id})</span>` : ''}
                    </div>
                    <div class="student-meta">
                        <small>Registered: ${new Date(student.registrationDate).toLocaleDateString()}</small>
                        <button class="delete-btn" data-index="${index}" aria-label="Delete student ${student.name}">
                            ×
                        </button>
                    </div>
                `;
                regList.appendChild(item);
            });

            // Add delete functionality
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', UIManager.handleStudentDelete);
            });
        },

        handleStudentDelete: (e) => {
            const index = parseInt(e.target.dataset.index);
            const student = SmartAttendance.registeredFaces[index];

            if (confirm(`Are you sure you want to delete ${student.name}?`)) {
                SmartAttendance.registeredFaces.splice(index, 1);
                SmartAttendance.Database.save();
                UIManager.refreshStudentList();
                UI.showResult(`${student.name} has been removed from the system.`, 'success');
            }
        },

        resetForm: () => {
            nameInput.value = '';
            idInput.value = '';
            fileInput.value = '';
            img.src = '';
            img.style.display = 'none';

            if (currentImageUrl) {
                URL.revokeObjectURL(currentImageUrl);
                currentImageUrl = null;
            }

            // Remove validation states
            [nameInput, idInput].forEach(input => {
                input.classList.remove('valid', 'invalid');
            });
        }
    };

    // Event Handlers
    const EventHandlers = {
        handleFileSelect: (e) => {
            const file = e.target.files[0];

            if (currentImageUrl) {
                URL.revokeObjectURL(currentImageUrl);
            }

            if (!file) {
                img.style.display = 'none';
                return;
            }

            const validation = Validation.validateFile(file);
            if (!validation.valid) {
                UI.showResult(validation.message, 'error');
                fileInput.value = '';
                return;
            }

            currentImageUrl = URL.createObjectURL(file);
            img.src = currentImageUrl;
            img.style.display = 'block';
            img.onload = () => {
                UI.showResult('Image loaded successfully. Ready for registration.', 'success');
            };
        },

        handleInputValidation: (input, validationFn) => {
            const value = input.value.trim();
            const validation = validationFn(value);

            input.classList.remove('valid', 'invalid');

            if (value) {
                input.classList.add(validation.valid ? 'valid' : 'invalid');
                if (!validation.valid) {
                    // Show validation message near input
                    input.setAttribute('data-error', validation.message);
                } else {
                    input.removeAttribute('data-error');
                }
            }
        },

        handleRegistration: async () => {
            if (isProcessing) return;

            const name = nameInput.value.trim();
            const id = idInput.value.trim();
            const file = fileInput.files[0];

            // Validate inputs
            const nameValidation = Validation.validateName(name);
            const idValidation = Validation.validateId(id);
            const fileValidation = Validation.validateFile(file);

            if (!nameValidation.valid) {
                UI.showResult(nameValidation.message, 'error');
                nameInput.focus();
                return;
            }

            if (!idValidation.valid) {
                UI.showResult(idValidation.message, 'error');
                idInput.focus();
                return;
            }

            if (!fileValidation.valid) {
                UI.showResult(fileValidation.message, 'error');
                fileInput.focus();
                return;
            }

            isProcessing = true;

            try {
                const result = await Registration.processRegistration(name, id, file);

                UI.showResult(`✅ Successfully registered ${result.student.name}!`, 'success');
                UI.showModal(`Registration complete! 
                    Student: ${result.student.name}
                    ${result.student.id ? `ID: ${result.student.id}` : ''}
                    Processing time: ${Math.round(result.performance.duration)}ms`, 'success');

                UIManager.refreshStudentList();
                UIManager.resetForm();

            } catch (error) {
                console.error('Registration failed:', error);

                let message = 'Registration failed. Please try again.';
                if (error instanceof SmartAttendanceError) {
                    message = error.message;
                }

                UI.showResult(`❌ ${message}`, 'error');
                UI.showModal(message, 'error');
            } finally {
                isProcessing = false;
                UI.hideLoading();
            }
        }
    };

    // Event Listeners
    modalClose.addEventListener('click', UI.hideModal);

    fileInput.addEventListener('change', EventHandlers.handleFileSelect);

    nameInput.addEventListener('input', () => {
        EventHandlers.handleInputValidation(nameInput, Validation.validateName);
    });

    idInput.addEventListener('input', () => {
        EventHandlers.handleInputValidation(idInput, Validation.validateId);
    });

    btn.addEventListener('click', EventHandlers.handleRegistration);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            UI.hideModal();
        }
        if (e.ctrlKey && e.key === 'Enter' && !isProcessing) {
            EventHandlers.handleRegistration();
        }
    });

    // Initialize UI
    UIManager.refreshStudentList();

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (currentImageUrl) {
            URL.revokeObjectURL(currentImageUrl);
        }
    });
});
