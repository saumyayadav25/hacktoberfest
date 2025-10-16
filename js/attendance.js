document.addEventListener('DOMContentLoaded', () => {
  // --- DOM elements ---
  const startBtn = document.getElementById('startWebcam');
  const runBtn = document.getElementById('verifyBtn');
  const exportBtn = document.getElementById('exportBtn');
  const video = document.getElementById('webcam');
  const attResult = document.getElementById('attResult');
  const todayList = document.getElementById('todayList');
  const modal = document.getElementById('modal');
  const modalMessage = document.getElementById('modalMessage');
  const modalClose = document.getElementById('modalClose');
  const attendanceTableBody = document.querySelector('#attendanceTable tbody');
  const searchInput = document.getElementById('searchInput');

  function showModal(msg) {
    modalMessage.innerText = msg;
    modal.classList.remove('hidden');
  }
  modalClose.addEventListener('click', () => modal.classList.add('hidden'));

  let stream = null,
      running = false;

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function todayISO() { return new Date().toISOString().slice(0, 10); }

  // --- Render today's attendance in sidebar/list ---
  function renderToday() {
    SmartAttendance.loadDB();
    SmartAttendance.registeredFaces.forEach(st => st.descriptor = new Float32Array(st.descriptor));
    const arr = SmartAttendance.attendanceLog[todayISO()] || [];
    todayList.innerHTML = arr.length ? '' : '<div class="item">No attendance yet</div>';
    arr.forEach(it => {
      const d = document.createElement('div');
      d.className = 'item';
      d.innerText = `${it.time} — ${it.name} ${it.id ? '(' + it.id + ')' : ''}`;
      todayList.appendChild(d);
    });
  }

  renderToday();

  // --- Webcam access ---
  startBtn.addEventListener('click', async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      video.play();
      runBtn.disabled = false;
      startBtn.disabled = true;
      attResult.innerText = 'Camera ready';
    } catch (e) {
      console.error(e);
      attResult.innerText = 'Cannot access camera';
      showModal('⚠️ Please allow webcam access or connect a camera.');
    }
  });

  // --- Attendance start/stop ---
  runBtn.addEventListener('click', async () => {
    if (!running) {
      running = true;
      runBtn.innerText = 'Stop Attendance';
      attResult.innerText = 'Loading models...';
      const ok = await SmartAttendance.loadModelsUI();
      if (!ok) {
        attResult.innerText = 'Model load failed';
        running = false;
        runBtn.innerText = 'Start Attendance';
        return;
      }
      attLoop();
    } else {
      running = false;
      runBtn.innerText = 'Start Attendance';
      attResult.innerText = 'Stopped';
    }
  });

  // --- Attendance loop ---
  async function attLoop() {
    attResult.innerText = 'Detecting...';
    while (running) {
      try {
        SmartAttendance.loadDB();
        SmartAttendance.registeredFaces.forEach(st => st.descriptor = new Float32Array(st.descriptor));
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors();
        if (!detections || !detections.length) { await sleep(500); continue; }

        // choose largest face in frame
        let best = detections[0]; 
        let maxA = 0;
        detections.forEach(d => {
          const b = d.detection.box;
          const a = b.width * b.height;
          if (a > maxA) { maxA = a; best = d; }
        });

        const match = SmartAttendance.bestMatch(best.descriptor, 0.65);
        if (match) {
          const res = SmartAttendance.markAttendanceRecord(match);
          if (res.ok) { 
            showModal(`Attendance done for ${match.name}`);
            renderToday();
            renderAttendanceHistory(searchInput.value.trim());
          } else attResult.innerText = 'Already marked recently';
        } else { attResult.innerText = 'Unknown face'; }

      } catch (e) {
        console.error(e);
        attResult.innerText = 'Error in loop';
        running = false;
        runBtn.innerText = 'Start Attendance';
      }
      await sleep(1000);
    }
  }

  // --- Export CSV ---
  exportBtn.addEventListener('click', () => {
    const rows = SmartAttendance.attendanceLog[todayISO()] || [];
    if (!rows.length) return alert('No records for today');
    const csv = ['Name,ID,Time'].concat(rows.map(r => `"${r.name}","${r.id}","${r.time}"`)).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = `attendance_${todayISO()}.csv`; 
    a.click();
    URL.revokeObjectURL(url);
  });

  // --- Attendance history table ---
  function renderAttendanceHistory(filter = '') {
    SmartAttendance.loadDB();
    const log = SmartAttendance.attendanceLog;

    attendanceTableBody.innerHTML = '';

    const dates = Object.keys(log).sort((a, b) => b.localeCompare(a));

    dates.forEach(date => {
      log[date].forEach(entry => {
        const nameMatch = entry.name.toLowerCase().includes(filter.toLowerCase());
        const idMatch = (entry.id || '').includes(filter);

        if (!filter || nameMatch || idMatch) {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${date}</td>
            <td>${entry.name}</td>
            <td>${entry.id || '-'}</td>
            <td>Present</td>
          `;
          attendanceTableBody.appendChild(tr);
        }
      });
    });

    if (!attendanceTableBody.children.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="4">No records found</td>`;
      attendanceTableBody.appendChild(tr);
    }
  }

  // Filter search
  searchInput.addEventListener('input', () => {
    renderAttendanceHistory(searchInput.value.trim());
  });

  // Initial render
  renderAttendanceHistory();
});
