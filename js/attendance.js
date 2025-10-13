document.addEventListener('DOMContentLoaded', ()=>{
  const startBtn = document.getElementById('startWebcam');
  const runBtn = document.getElementById('verifyBtn');
  const exportBtn = document.getElementById('exportBtn');
  const video = document.getElementById('webcam');
  const attResult = document.getElementById('attResult');
  const todayList = document.getElementById('todayList');
  const historyTableBody = document.querySelector('#historyTable tbody');
  const searchInput = document.getElementById('searchInput');
  const dateInput = document.getElementById('dateInput');
  const modal = document.getElementById('modal');
  const modalMessage = document.getElementById('modalMessage');
  const modalClose = document.getElementById('modalClose');

  function showModal(msg){ modalMessage.innerText = msg; modal.classList.remove('hidden'); }
  modalClose.addEventListener('click', ()=> modal.classList.add('hidden'));

  let stream=null, running=false;

  function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

  function todayISO(){ return new Date().toISOString().slice(0,10); }

  function renderToday(){
    SmartAttendance.loadDB();
    SmartAttendance.registeredFaces.forEach(st=> st.descriptor = new Float32Array(st.descriptor));
    const arr = SmartAttendance.attendanceLog[todayISO()] || [];
    todayList.innerHTML = arr.length? '' : '<div class="item">No attendance yet</div>';
    arr.forEach(it=>{
      const d=document.createElement('div');
      d.className='item';
      d.innerText = `${it.time} — ${it.name} ${it.id? '('+it.id+')':''}`;
      todayList.appendChild(d);
    });
  }

  renderToday();

  function renderHistory(){
    if(!historyTableBody) return;
    SmartAttendance.loadDB();
    const entries = [];
    for(const day in SmartAttendance.attendanceLog){
      (SmartAttendance.attendanceLog[day]||[]).forEach(it=>{
        entries.push({ date: day, name: it.name, id: it.id||'', time: it.time });
      });
    }

    const q = (searchInput?.value || '').toLowerCase();
    const selDate = dateInput?.value || '';
    const filtered = entries.filter(e=>{
      const matchQ = !q || e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q);
      const matchD = !selDate || e.date === selDate;
      return matchQ && matchD;
    }).sort((a,b)=> (a.date+b.time < b.date+a.time ? 1 : -1));

    historyTableBody.innerHTML = '';
    if(!filtered.length){
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4; td.textContent = 'No records';
      tr.appendChild(td); historyTableBody.appendChild(tr);
      return;
    }

    filtered.forEach(e=>{
      const tr=document.createElement('tr');
      tr.innerHTML = `<td>${e.date}</td><td>${e.name}</td><td>${e.id||'-'}</td><td>${e.time}</td>`;
      historyTableBody.appendChild(tr);
    });
  }

  searchInput?.addEventListener('input', renderHistory);
  dateInput?.addEventListener('change', renderHistory);
  renderHistory();

  startBtn.addEventListener('click', async ()=>{
    try{
      stream = await navigator.mediaDevices.getUserMedia({ video:true });
      video.srcObject = stream; video.play();
      runBtn.disabled=false; startBtn.disabled=true;
      attResult.innerText='Camera ready';
    }catch(e){ console.error(e); attResult.innerText='Cannot access camera'; }
  });

  runBtn.addEventListener('click', async ()=>{
    if(!running){
      running=true; runBtn.innerText='Stop Attendance'; attResult.innerText='Loading models...';
      const ok = await SmartAttendance.loadModelsUI();
      if(!ok){ attResult.classList.add('error'); attResult.innerText='Model load failed'; running=false; runBtn.innerText='Start Attendance'; return; }
      attLoop();
    } else {
      running=false; runBtn.innerText='Start Attendance'; attResult.innerText='Stopped';
    }
  });

  async function attLoop(){
    attResult.innerText='Detecting...';
    while(running){
      try{
        SmartAttendance.loadDB();
        SmartAttendance.registeredFaces.forEach(st=> st.descriptor = new Float32Array(st.descriptor));
        const detections = await faceapi.detectAllFaces(video,new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
        if(!detections || !detections.length){ await sleep(500); continue; }

        let best=detections[0]; let maxA=0;
        detections.forEach(d=>{
          const b=d.detection.box;
          const a=b.width*b.height;
          if(a>maxA){ maxA=a; best=d; }
        });

        const match = SmartAttendance.bestMatch(best.descriptor,0.65);
        if(match){
          const res = SmartAttendance.markAttendanceRecord(match);
          if(res.ok){ showModal(`Attendance done for ${match.name}`); attResult.classList.remove('error'); renderToday(); renderHistory(); }
          else { attResult.classList.add('error'); attResult.innerText='Already marked recently'; }
        } else { attResult.classList.add('error'); attResult.innerText='Unknown face'; }

      }catch(e){ console.error(e); attResult.innerText='Error in loop'; running=false; runBtn.innerText='Start Attendance'; }
      await sleep(1000);
    }
  }

  exportBtn.addEventListener('click', ()=>{
    const rows = SmartAttendance.attendanceLog[todayISO()] || [];
    if(!rows.length) return alert('No records for today');
    const csv = ['Name,ID,Time'].concat(rows.map(r=>`"${r.name}","${r.id}","${r.time}"`)).join('\n');
    const blob = new Blob([csv], { type:'text/csv' });
    const url = URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`attendance_${todayISO()}.csv`; a.click();
    URL.revokeObjectURL(url);
  });

});
