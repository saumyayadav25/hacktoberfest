const MODELS_PATH = './models';

// Data keys
const KEY_REG = 'ft_registered_faces_v1';
const KEY_ATT = 'ft_attendance_log_v1';

// In-memory caches
let registeredFaces = []; // {name,id,descriptor:Float32Array}
let attendanceLog = {}; // { 'YYYY-MM-DD': [ {name,id,time,timestamp} ] }

// Load/save helpers
function saveDB() {
  try {
    const r = registeredFaces.map(rf => ({ name: rf.name, id: rf.id, descriptor: Array.from(rf.descriptor) }));
    localStorage.setItem(KEY_REG, JSON.stringify(r));
    localStorage.setItem(KEY_ATT, JSON.stringify(attendanceLog));
  } catch (e) { console.error('saveDB error', e); }
}

function loadDB() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY_REG) || '[]');
    registeredFaces = r.map(x => ({ name: x.name, id: x.id, descriptor: new Float32Array(x.descriptor) }));
  } catch (e) { registeredFaces = []; }

  try {
    attendanceLog = JSON.parse(localStorage.getItem(KEY_ATT) || '{}');
  } catch (e) { attendanceLog = {}; }
}

// date helpers
function todayISO() { return new Date().toISOString().slice(0,10); }
function timeNow() { return new Date().toLocaleTimeString(); }

// euclidean distance
function euclidean(a,b){ let s=0; for(let i=0;i<a.length;i++){ const d=a[i]-b[i]; s+=d*d; } return Math.sqrt(s); }

// find best match
function bestMatch(descriptor, threshold=0.6){
  if(!registeredFaces.length) return null;
  let best={idx:-1,dist:Infinity};
  for(let i=0;i<registeredFaces.length;i++){
    const d = euclidean(descriptor, registeredFaces[i].descriptor);
    if(d < best.dist){ best = { idx:i, dist:d }; }
  }
  if(best.dist < threshold) return { ...registeredFaces[best.idx], distance: best.dist };
  return null;
}

// mark attendance
function markAttendanceRecord(person){
  const day = todayISO();
  if(!attendanceLog[day]) attendanceLog[day] = [];
  // duplicate prevention: same id or name within 5 min
  const cutoff = Date.now() - 5*60*1000;
  if(attendanceLog[day].some(it => (it.id === person.id || it.name === person.name) && it.timestamp > cutoff)) return { ok:false, msg:'recent' };
  attendanceLog[day].push({ name: person.name, id: person.id||'', time: timeNow(), timestamp: Date.now() });
  saveDB();
  return { ok:true };
}

// model loader
async function loadModelsUI(){
  try{
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_PATH),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_PATH),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_PATH)
    ]);
    return true;
  } catch(e){ console.error('model load',e); return false; }
}

// initialize DB into memory
loadDB();

// ------------------- Dark/Light Mode Integration -------------------
const themeToggleButtons = document.querySelectorAll('#theme-toggle');
const body = document.body;

// Initialize theme from localStorage
if (localStorage.getItem('theme') === 'dark') {
  body.classList.add('dark-mode');
  themeToggleButtons.forEach(btn => btn.textContent = '🌕');
}

// Add toggle event for each page
themeToggleButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    body.classList.toggle('dark-mode');
    const isDark = body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeToggleButtons.forEach(b => b.textContent = isDark ? '🌕' : '🌙');
  });
});

// expose
window.SmartAttendance = { registeredFaces, attendanceLog, saveDB, loadDB, bestMatch, markAttendanceRecord, loadModelsUI };
