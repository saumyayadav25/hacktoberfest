const MODELS_PATH = './models';
const KEY_ATT = 'ft_attendance_log_v1';

// The registeredFaces array is no longer needed here.
// It will be handled by the 'activeStudent' variable created in other scripts.
let attendanceLog = {};

function saveAttendanceLog() {
    try {
        localStorage.setItem(KEY_ATT, JSON.stringify(attendanceLog));
    } catch (e) { console.error('saveAttendanceLog error', e); }
}

function loadAttendanceLog() {
    try {
        attendanceLog = JSON.parse(localStorage.getItem(KEY_ATT) || '{}');
    } catch (e) { attendanceLog = {}; }
}

// This function now needs a registered student object passed to it.
function bestMatch(descriptor, registeredStudent, threshold = 0.6) {
    if (!registeredStudent || !registeredStudent.descriptor) return null;

    const d = faceapi.euclideanDistance(descriptor, registeredStudent.descriptor);

    if (d < threshold) {
        return { ...registeredStudent, distance: d };
    }
    return null;
}

function markAttendanceRecord(person) {
    const day = new Date().toISOString().slice(0, 10);
    if (!attendanceLog[day]) attendanceLog[day] = [];

    const cutoff = Date.now() - 5 * 60 * 1000;
    if (attendanceLog[day].some(it => (it.id === person.id || it.name === person.name) && it.timestamp > cutoff)) {
        return { ok: false, msg: 'recent' };
    }

    attendanceLog[day].push({ name: person.name, id: person.id || '', time: new Date().toLocaleTimeString(), timestamp: Date.now() });
    saveAttendanceLog();
    return { ok: true };
}

// Model loader - FIXED THE TYPO
async function loadModelsUI() {
    try {
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_PATH),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_PATH),  // ✅ Fixed: MODELS_PATH instead of MODOELS_PATH
            faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_PATH)
        ]);
        console.log('All models loaded successfully');
        return true;
    } catch (e) {
        console.error('model load error:', e);
        return false;
    }
}

loadAttendanceLog();

window.SmartAttendance = {
    attendanceLog,
    bestMatch,
    markAttendanceRecord,
    loadModelsUI
};
