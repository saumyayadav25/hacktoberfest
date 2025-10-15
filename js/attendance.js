document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const video = document.getElementById('webcam');
  const startBtn = document.getElementById('startWebcam');
  const runBtn = document.getElementById('verifyBtn');
  const exportBtn = document.getElementById('exportBtn');
  const attResult = document.getElementById('attResult');
  const todayList = document.getElementById('todayList');
  const modal = document.getElementById('modal');
  const modalMessage = document.getElementById('modalMessage');
  const modalClose = document.getElementById('modalClose');

  // State variables
  let stream = null;
  let running = false;
  let currentFacingMode = 'user'; // front camera by default

  // Helper functions
  function showModal(msg) {
    modalMessage.innerHTML = msg;
    modal.classList.remove('hidden');
  }

  function hideModal() {
    modal.classList.add('hidden');
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function getCameraErrorMessage(error) {
    switch (error.name) {
      case 'NotAllowedError':
        return 'Camera access was denied. Please allow camera access in your browser settings.';
      case 'NotFoundError':
        return 'No camera found. Please connect a camera and try again.';
      case 'NotReadableError':
        return 'Camera is already in use by another application.';
      case 'OverconstrainedError':
        return 'The requested camera configuration is not supported.';
      default:
        return `Error accessing camera: ${error.message}`;
    }
  }

  // Render today's attendance list
  function renderToday() {
    SmartAttendance.loadDB();
    SmartAttendance.registeredFaces.forEach(st => {
      st.descriptor = new Float32Array(st.descriptor);
    });
    
    const arr = SmartAttendance.attendanceLog[todayISO()] || [];
    todayList.innerHTML = arr.length ? '' : '<div class="alert alert-info">No attendance recorded yet for today.</div>';
    
    arr.forEach(it => {
      const item = document.createElement('div');
      item.className = 'alert alert-light d-flex justify-content-between align-items-center';
      item.innerHTML = `
        <div>
          <strong>${it.name}</strong> ${it.id ? `(${it.id})` : ''}
          <div class="text-muted small">${it.time}</div>
        </div>
      `;
      todayList.appendChild(item);
    });
  }

  // Initialize the page
  renderToday();

  // Toggle webcam on/off
  startBtn.addEventListener('click', async () => {
    try {
      if (stream) {
        // Stop the current stream
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        video.srcObject = null;
        video.classList.remove('active');
        startBtn.textContent = 'Enable Webcam';
        runBtn.disabled = true;
        return;
      }

      // Request camera access
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: currentFacingMode
        },
        audio: false
      };

      attResult.textContent = 'Requesting camera access...';
      attResult.className = 'alert alert-info';
      
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      video.classList.add('active');
      
      // When video starts playing
      video.onloadedmetadata = () => {
        video.play().then(() => {
          startBtn.textContent = 'Stop Camera';
          runBtn.disabled = false;
          attResult.textContent = 'Camera ready. Click "Start Attendance" to begin.';
          attResult.className = 'alert alert-success';
        }).catch(err => {
          console.error('Error playing video:', err);
          attResult.textContent = 'Error starting camera: ' + err.message;
          attResult.className = 'alert alert-danger';
        });
      };
      
      video.onerror = (err) => {
        console.error('Video error:', err);
        attResult.textContent = 'Error with video stream';
        attResult.className = 'alert alert-danger';
      };
      
    } catch (err) {
      console.error('Camera access error:', err);
      attResult.textContent = getCameraErrorMessage(err);
      attResult.className = 'alert alert-danger';
      runBtn.disabled = true;
    }
  });

  // Toggle face detection
  runBtn.addEventListener('click', async () => {
    if (!running) {
      // Start attendance
      if (!stream || !stream.active) {
        attResult.textContent = 'Please enable the camera first';
        attResult.className = 'alert alert-warning';
        return;
      }

      running = true;
      runBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Stop Attendance';
      runBtn.classList.add('btn-danger');
      runBtn.classList.remove('btn-primary');
      
      attResult.textContent = 'Loading face recognition models...';
      attResult.className = 'alert alert-info';

      try {
        const ok = await SmartAttendance.loadModelsUI();
        if (!ok) {
          throw new Error('Failed to load face recognition models');
        }
        
        attResult.textContent = 'Face detection active. Looking for registered faces...';
        attLoop();
        
      } catch (err) {
        console.error('Error starting attendance:', err);
        attResult.textContent = 'Error: ' + (err.message || 'Failed to start face recognition');
        attResult.className = 'alert alert-danger';
        running = false;
        runBtn.textContent = 'Start Attendance';
        runBtn.classList.remove('btn-danger', 'spinner-border');
        runBtn.classList.add('btn-primary');
      }
      
    } else {
      // Stop attendance
      running = false;
      runBtn.textContent = 'Start Attendance';
      runBtn.classList.remove('btn-danger', 'spinner-border');
      runBtn.classList.add('btn-primary');
      attResult.textContent = 'Attendance tracking stopped';
      attResult.className = 'alert alert-info';
    }
  });

  // Face detection loop
  async function attLoop() {
    while (running) {
      try {
        // Load and prepare the database
        SmartAttendance.loadDB();
        SmartAttendance.registeredFaces.forEach(st => {
          st.descriptor = new Float32Array(st.descriptor);
        });

        // Check if we have any registered faces
        if (SmartAttendance.registeredFaces.length === 0) {
          attResult.textContent = 'No registered faces found. Please register students first.';
          attResult.className = 'alert alert-warning';
          running = false;
          runBtn.textContent = 'Start Attendance';
          runBtn.classList.remove('btn-danger', 'spinner-border');
          runBtn.classList.add('btn-primary');
          return;
        }

        // Detect faces in the current video frame
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors();

        // If no faces detected, continue to next frame
        if (!detections || detections.length === 0) {
          attResult.textContent = 'No faces detected. Make sure your face is visible.';
          attResult.className = 'alert alert-info';
          await sleep(500);
          continue;
        }

        // Find the largest face in the frame
        let best = detections[0];
        let maxArea = 0;
        
        detections.forEach(d => {
          const box = d.detection.box;
          const area = box.width * box.height;
          if (area > maxArea) {
            maxArea = area;
            best = d;
          }
        });

        // Try to match the face with registered faces
        const match = SmartAttendance.bestMatch(best.descriptor, 0.6);
        
        if (match) {
          // Mark attendance for the matched face
          const res = SmartAttendance.markAttendanceRecord(match);
          
          if (res.ok) {
            // Show success message and update the UI
            showModal(`<div class="text-center">
              <i class="bi bi-check-circle-fill text-success mb-3" style="font-size: 3rem;"></i>
              <h4>Attendance Recorded</h4>
              <p>${match.name} (${match.id || 'No ID'})</p>
              <p class="text-muted">${new Date().toLocaleTimeString()}</p>
            </div>`);
            
            attResult.textContent = `Attendance recorded for ${match.name}`;
            attResult.className = 'alert alert-success';
            
            // Update the attendance list
            renderToday();
            
            // Pause briefly to prevent multiple detections
            await sleep(2000);
          } else {
            attResult.textContent = `Attendance already recorded for ${match.name} recently`;
            attResult.className = 'alert alert-warning';
            await sleep(1000);
          }
        } else {
          attResult.textContent = 'Unknown face. Please register first.';
          attResult.className = 'alert alert-warning';
          await sleep(1000);
        }

      } catch (err) {
        console.error('Error in attendance loop:', err);
        attResult.textContent = 'Error: ' + (err.message || 'Failed to process face detection');
        attResult.className = 'alert alert-danger';
        running = false;
        runBtn.textContent = 'Start Attendance';
        runBtn.classList.remove('btn-danger', 'spinner-border');
        runBtn.classList.add('btn-primary');
      }
      
      // Small delay to prevent UI freeze
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
  }

  // Export attendance data
  exportBtn.addEventListener('click', () => {
    const rows = SmartAttendance.attendanceLog[todayISO()] || [];
    if (!rows.length) {
      showModal('<div class="text-center"><i class="bi bi-exclamation-triangle text-warning mb-3" style="font-size: 3rem;"></i><h4>No Records</h4><p>No attendance records found for today.</p></div>');
      return;
    }
    
    // Create CSV content
    const headers = ['Name', 'ID', 'Time'];
    const csvRows = [
      headers.join(','),
      ...rows.map(row => 
        `"${row.name}","${row.id || ''}","${row.time}"`
      )
    ];
    
    // Create and trigger download
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_${todayISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  // Modal close handler
  modalClose.addEventListener('click', hideModal);
  
  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      hideModal();
    }
  });

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  });
});
