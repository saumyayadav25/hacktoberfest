let activeStudent = null; // This will hold the "official" student from the database.

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('http://localhost:3000/api/student');
        if (response.ok) {
            activeStudent = await response.json();
            console.log('Successfully fetched active student:', activeStudent.name);
            document.getElementById('attResult').innerText = `Ready to take attendance for ${activeStudent.name}.`;
        } else {
            console.log('No student is currently registered in the database.');
            document.getElementById('attResult').innerText = 'No student is registered. Please go to the Register page.';
        }
    } catch (error) {
        console.error('Failed to fetch student data:', error);
        document.getElementById('attResult').innerText = 'Could not connect to the server.';
    }
});


// This is the existing code, with a small but important modification in the attLoop function.
document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('startWebcam');
    const runBtn = document.getElementById('verifyBtn');
    const exportBtn = document.getElementById('exportBtn');
    const video = document.getElementById('webcam');
    const attResult = document.getElementById('attResult');
    const todayList = document.getElementById('todayList');
    const modal = document.getElementById('modal');
    const modalMessage = document.getElementById('modalMessage');
    const modalClose = document.getElementById('modalClose');

    function showModal(msg) { modalMessage.innerText = msg; modal.classList.remove('hidden'); }
    modalClose.addEventListener('click', () => modal.classList.add('hidden'));

    let stream = null, running = false;

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    function todayISO() { return new Date().toISOString().slice(0, 10); }

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

    startBtn.addEventListener('click', async () => {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream; video.play();
            runBtn.disabled = false; startBtn.disabled = true;
            // attResult.innerText='Camera ready'; // This line is now handled by the fetch logic
        } catch (e) { console.error(e); attResult.innerText = 'Cannot access camera'; }
    });

    runBtn.addEventListener('click', async () => {
        if (!running) {
            if (!activeStudent) {
                showModal('No student is registered in the database. Please register first.');
                return;
            }
            running = true; runBtn.innerText = 'Stop Attendance'; attResult.innerText = 'Loading models...';
            const ok = await SmartAttendance.loadModelsUI();
            if (!ok) { attResult.innerText = 'Model load failed'; running = false; runBtn.innerText = 'Start Attendance'; return; }
            attLoop();
        } else {
            running = false; runBtn.innerText = 'Start Attendance'; attResult.innerText = 'Stopped';
        }
    });

    async function attLoop() {
        attResult.innerText = 'Detecting...';
        while (running) {
            try {
                // We still load from localStorage here because it holds the face descriptor data
                SmartAttendance.loadDB();
                SmartAttendance.registeredFaces.forEach(st => st.descriptor = new Float32Array(st.descriptor));

                const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
                if (!detections || !detections.length) { await sleep(500); continue; }

                let best = detections[0]; let maxA = 0;
                detections.forEach(d => {
                    const b = d.detection.box;
                    const a = b.width * b.height;
                    if (a > maxA) { maxA = a; best = d; }
                });

                const match = SmartAttendance.bestMatch(best.descriptor, activeStudent, 0.65);

                // We check if a face was matched AND if that match is the same student from our database.
                if (match && activeStudent && match.name === activeStudent.name) {
                    const res = SmartAttendance.markAttendanceRecord(match);
                    if (res.ok) { showModal(`Attendance done for ${match.name}`); renderToday(); }
                    else { attResult.innerText = 'Already marked recently'; }
                } else {
                    attResult.innerText = 'Unknown face';
                }

            } catch (e) { console.error(e); attResult.innerText = 'Error in loop'; running = false; runBtn.innerText = 'Start Attendance'; }
            await sleep(1000);
        }
    }

    exportBtn.addEventListener('click', () => {
        const rows = SmartAttendance.attendanceLog[todayISO()] || [];
        if (!rows.length) return alert('No records for today');
        const csv = ['Name,ID,Time'].concat(rows.map(r => `"${r.name}","${r.id}","${r.time}"`)).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `attendance_${todayISO()}.csv`; a.click();
        URL.revokeObjectURL(url);
    });
});