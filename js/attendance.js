
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const elements = {
        startBtn: document.getElementById('startWebcam'),
        runBtn: document.getElementById('verifyBtn'),
        exportBtn: document.getElementById('exportBtn'),
        video: document.getElementById('webcam'),
        result: document.getElementById('attResult'),
        todayList: document.getElementById('todayList'),
        modal: document.getElementById('modal'),
        modalMessage: document.getElementById('modalMessage'),
        modalClose: document.getElementById('modalClose')
    };

    // State management
    let state = {
        stream: null,
        running: false,
        processing: false,
        detectionCount: 0,
        successCount: 0,
        frameRate: 0,
        lastFrameTime: 0
    };

    // Configuration
    const ATTENDANCE_CONFIG = {
        DETECTION_INTERVAL: 1500, // ms between detections
        CONFIDENCE_THRESHOLD: 0.65,
        MIN_DETECTION_SIZE: 100,
        MAX_DETECTION_ATTEMPTS: 3,
        FRAME_SKIP: 2 // Skip frames for performance
    };

    // UI Management
    const UI = {
        showModal: (message, type = 'info') => {
            elements.modalMessage.textContent = message;
            elements.modal.classList.remove('hidden');
            elements.modal.setAttribute('data-type', type);

            // Auto-hide success messages after 3 seconds
            if (type === 'success') {
                setTimeout(() => UI.hideModal(), 3000);
            }
        },

        hideModal: () => {
            elements.modal.classList.add('hidden');
        },

        updateResult: (message, type = 'info') => {
            elements.result.textContent = message;
            elements.result.className = `result ${type}`;
            elements.result.setAttribute('aria-live', 'polite');
        },

        updateStats: () => {
            const stats = `Detections: ${state.detectionCount} | Matches: ${state.successCount} | FPS: ${state.frameRate}`;
            console.log(stats);
        },

        setButtonState: (button, disabled, text) => {
            button.disabled = disabled;
            button.textContent = text;
        }
    };

    // Camera Management
    const Camera = {
        start: async () => {
            try {
                // Check camera permissions first
                const permissions = await navigator.permissions.query({name: 'camera'});
                if (permissions.state === 'denied') {
                    throw new Error('Camera access denied. Please enable camera permissions.');
                }

                UI.updateResult('Starting camera...', 'loading');

                const constraints = {
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        frameRate: { ideal: 30 },
                        facingMode: 'user'
                    }
                };

                state.stream = await navigator.mediaDevices.getUserMedia(constraints);
                elements.video.srcObject = state.stream;

                await new Promise((resolve) => {
                    elements.video.onloadedmetadata = resolve;
                });

                await elements.video.play();

                UI.setButtonState(elements.runBtn, false, 'Start Attendance');
                UI.setButtonState(elements.startBtn, true, 'Camera Running');
                UI.updateResult('Camera ready. Click "Start Attendance" to begin.', 'success');

                return { success: true };
            } catch (error) {
                console.error('Camera start error:', error);
                UI.updateResult(`Camera error: ${error.message}`, 'error');
                return { success: false, error: error.message };
            }
        },

        stop: () => {
            if (state.stream) {
                state.stream.getTracks().forEach(track => track.stop());
                state.stream = null;
                elements.video.srcObject = null;
            }

            UI.setButtonState(elements.startBtn, false, 'Start Webcam');
            UI.setButtonState(elements.runBtn, true, 'Start Attendance');
        },

        isRunning: () => {
            return state.stream && state.stream.active;
        }
    };

    // Enhanced face detection with performance optimization
    const FaceDetection = {
        detect: async () => {
            if (!state.running || state.processing) return;

            state.processing = true;
            state.detectionCount++;

            try {
                SmartAttendance.PerformanceMonitor.start('detection');

                // Load database
                SmartAttendance.Database.load();

                // Skip frames for performance
                if (state.detectionCount % ATTENDANCE_CONFIG.FRAME_SKIP !== 0) {
                    state.processing = false;
                    return;
                }

                // Detect faces with optimized options
                const detections = await faceapi
                    .detectAllFaces(elements.video, new faceapi.TinyFaceDetectorOptions({
                        inputSize: 416,
                        scoreThreshold: 0.4
                    }))
                    .withFaceLandmarks()
                    .withFaceDescriptors();

                SmartAttendance.PerformanceMonitor.end('detection');

                if (!detections || !detections.length) {
                    UI.updateResult('No face detected. Please position yourself in front of the camera.', 'info');
                    return;
                }

                // Find the best (largest) face
                let bestDetection = detections[0];
                let maxArea = 0;

                detections.forEach(detection => {
                    const box = detection.detection.box;
                    const area = box.width * box.height;

                    if (area > maxArea && area > ATTENDANCE_CONFIG.MIN_DETECTION_SIZE) {
                        maxArea = area;
                        bestDetection = detection;
                    }
                });

                if (maxArea < ATTENDANCE_CONFIG.MIN_DETECTION_SIZE) {
                    UI.updateResult('Face too small or far away. Please move closer to the camera.', 'warning');
                    return;
                }

                // Find matching registered face
                const match = SmartAttendance.FaceRecognition.findBestMatch(
                    bestDetection.descriptor,
                    ATTENDANCE_CONFIG.CONFIDENCE_THRESHOLD
                );

                if (match) {
                    await FaceDetection.handleMatch(match);
                } else {
                    UI.updateResult('Unknown face detected. Please register first.', 'warning');
                }

            } catch (error) {
                console.error('Detection error:', error);
                UI.updateResult('Detection error occurred. Please try again.', 'error');
            } finally {
                state.processing = false;
                FaceDetection.updateFrameRate();
            }
        },

        handleMatch: async (match) => {
            SmartAttendance.PerformanceMonitor.start('attendance');

            try {
                const result = SmartAttendance.AttendanceManager.mark(match);

                if (result.success) {
                    state.successCount++;
                    UI.showModal(`✅ Attendance marked for ${match.name}
                        Confidence: ${(match.confidence * 100).toFixed(1)}%
                        Time: ${result.record.time}`, 'success');
                    UI.updateResult(`Attendance recorded for ${match.name}`, 'success');
                    AttendanceUI.refreshTodayList();
                } else {
                    UI.updateResult(result.message, 'warning');
                }
            } catch (error) {
                console.error('Attendance marking error:', error);
                UI.updateResult('Failed to mark attendance. Please try again.', 'error');
            }

            SmartAttendance.PerformanceMonitor.end('attendance');
        },

        updateFrameRate: () => {
            const now = performance.now();
            if (state.lastFrameTime > 0) {
                const fps = 1000 / (now - state.lastFrameTime);
                state.frameRate = Math.round(fps);
            }
            state.lastFrameTime = now;
            UI.updateStats();
        },

        loop: async () => {
            while (state.running && Camera.isRunning()) {
                await FaceDetection.detect();
                await new Promise(resolve => setTimeout(resolve, ATTENDANCE_CONFIG.DETECTION_INTERVAL));
            }
        }
    };

    // Attendance UI Management
    const AttendanceUI = {
        refreshTodayList: () => {
            const records = SmartAttendance.AttendanceManager.getTodayRecords();

            elements.todayList.innerHTML = '';

            if (!records.length) {
                elements.todayList.innerHTML = '<div class="empty-state">No attendance recorded yet today</div>';
                return;
            }

            records.forEach(record => {
                const item = document.createElement('div');
                item.className = 'attendance-item';
                item.innerHTML = `
                    <div class="attendance-info">
                        <span class="student-name">${record.name}</span>
                        ${record.id ? `<span class="student-id">(${record.id})</span>` : ''}
                        <span class="attendance-time">${record.time}</span>
                    </div>
                    ${record.confidence ? 
                        `<div class="confidence">Confidence: ${(record.confidence * 100).toFixed(1)}%</div>` : 
                        ''
                    }
                `;
                elements.todayList.appendChild(item);
            });

            // Update export button state
            elements.exportBtn.disabled = false;
        },

        exportCSV: () => {
            try {
                const csvContent = SmartAttendance.AttendanceManager.exportToCSV();
                const today = SmartAttendance.Utils.todayISO();

                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);

                const link = document.createElement('a');
                link.href = url;
                link.download = `attendance_${today}.csv`;
                link.style.display = 'none';

                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                URL.revokeObjectURL(url);

                UI.showModal(`Attendance exported successfully for ${today}`, 'success');
            } catch (error) {
                console.error('Export error:', error);

                if (error instanceof SmartAttendanceError && error.code === 'NO_RECORDS') {
                    UI.showModal('No attendance records found for today.', 'warning');
                } else {
                    UI.showModal('Failed to export attendance data.', 'error');
                }
            }
        }
    };

    // Event Handlers
    const EventHandlers = {
        startCamera: async () => {
            UI.setButtonState(elements.startBtn, true, 'Starting...');
            const result = await Camera.start();

            if (!result.success) {
                UI.setButtonState(elements.startBtn, false, 'Start Webcam');
            }
        },

        toggleAttendance: async () => {
            if (!state.running) {
                // Start attendance
                if (!Camera.isRunning()) {
                    UI.updateResult('Please start the webcam first.', 'error');
                    return;
                }

                UI.setButtonState(elements.runBtn, true, 'Loading...');
                UI.updateResult('Loading AI models...', 'loading');

                const modelResult = await SmartAttendance.ModelLoader.load();
                if (!modelResult.success) {
                    UI.updateResult('Failed to load AI models. Please refresh and try again.', 'error');
                    UI.setButtonState(elements.runBtn, false, 'Start Attendance');
                    return;
                }

                state.running = true;
                state.detectionCount = 0;
                state.successCount = 0;

                UI.setButtonState(elements.runBtn, false, 'Stop Attendance');
                UI.updateResult('Attendance detection started. Looking for faces...', 'success');

                FaceDetection.loop();
            } else {
                // Stop attendance
                state.running = false;
                state.processing = false;

                UI.setButtonState(elements.runBtn, false, 'Start Attendance');
                UI.updateResult('Attendance detection stopped.', 'info');
            }
        }
    };

    // Event Listeners
    elements.modalClose.addEventListener('click', UI.hideModal);
    elements.startBtn.addEventListener('click', EventHandlers.startCamera);
    elements.runBtn.addEventListener('click', EventHandlers.toggleAttendance);
    elements.exportBtn.addEventListener('click', AttendanceUI.exportCSV);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            UI.hideModal();
            if (state.running) {
                EventHandlers.toggleAttendance();
            }
        }
        if (e.key === ' ' && !state.running && Camera.isRunning()) {
            e.preventDefault();
            EventHandlers.toggleAttendance();
        }
    });

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (state.running) {
            state.running = false;
        }
        Camera.stop();
    });

    // Visibility change handler (pause when tab not visible)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && state.running) {
            state.running = false;
            UI.updateResult('Attendance paused (tab not visible)', 'info');
            UI.setButtonState(elements.runBtn, false, 'Start Attendance');
        }
    });

    // Initialize
    AttendanceUI.refreshTodayList();

    // Performance reporting (development only)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        setInterval(() => {
            const report = SmartAttendance.PerformanceMonitor.getReport();
            console.table(report);
        }, 10000);
    }
});
