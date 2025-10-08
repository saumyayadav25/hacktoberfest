
// Fixed version of common.js with improvements

// Configuration
const CONFIG = {
    MODELS_PATH: window.location.protocol === 'file:' ? './models' : '/models',
    RECOGNITION_THRESHOLD: 0.6,
    MIN_FACE_SIZE: 160,
    DUPLICATE_PREVENTION_MINUTES: 5,
    MAX_RETRIES: 3
};

// Data keys with versioning
const STORAGE_KEYS = {
    REGISTERED_FACES: 'smart_attendance_faces_v2',
    ATTENDANCE_LOG: 'smart_attendance_log_v2',
    SETTINGS: 'smart_attendance_settings_v1'
};

// In-memory caches
let registeredFaces = [];
let attendanceLog = {};
let settings = { theme: 'light', language: 'en' };

// Utility functions
const Utils = {
    // Input validation
    validateName: (name) => {
        if (!name || typeof name !== 'string') return false;
        const trimmedName = name.trim();
        return trimmedName.length >= 2 && trimmedName.length <= 50 && /^[a-zA-Z\s'-]+$/.test(trimmedName);
    },

    validateId: (id) => {
        if (!id) return true; // ID is optional
        const trimmedId = id.toString().trim();
        return trimmedId.length <= 20 && /^[a-zA-Z0-9-_]+$/.test(trimmedId);
    },

    // Sanitize input to prevent XSS
    sanitizeInput: (input) => {
        if (typeof input !== 'string') return '';
        return input.replace(/[<>"'&]/g, (match) => {
            const map = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' };
            return map[match];
        });
    },

    // Date helpers with timezone support
    todayISO: () => new Date().toISOString().slice(0, 10),
    timeNow: () => new Date().toLocaleTimeString(),
    timestamp: () => Date.now()
};

// Enhanced error handling
class SmartAttendanceError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'SmartAttendanceError';
        this.code = code;
        this.details = details;
    }
}

// Database operations with improved error handling
const Database = {
    save: () => {
        try {
            const faceData = registeredFaces.map(face => ({
                ...face,
                descriptor: Array.from(face.descriptor)
            }));

            localStorage.setItem(STORAGE_KEYS.REGISTERED_FACES, JSON.stringify(faceData));
            localStorage.setItem(STORAGE_KEYS.ATTENDANCE_LOG, JSON.stringify(attendanceLog));
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));

            return { success: true };
        } catch (error) {
            console.error('Database save error:', error);
            return { success: false, error: error.message };
        }
    },

    load: () => {
        try {
            // Load registered faces
            const faceData = localStorage.getItem(STORAGE_KEYS.REGISTERED_FACES);
            if (faceData) {
                const parsed = JSON.parse(faceData);
                registeredFaces = parsed.map(face => ({
                    ...face,
                    descriptor: new Float32Array(face.descriptor)
                }));
            }

            // Load attendance log
            const logData = localStorage.getItem(STORAGE_KEYS.ATTENDANCE_LOG);
            if (logData) {
                attendanceLog = JSON.parse(logData);
            }

            // Load settings
            const settingsData = localStorage.getItem(STORAGE_KEYS.SETTINGS);
            if (settingsData) {
                settings = { ...settings, ...JSON.parse(settingsData) };
            }

            return { success: true };
        } catch (error) {
            console.error('Database load error:', error);
            registeredFaces = [];
            attendanceLog = {};
            return { success: false, error: error.message };
        }
    },

    export: () => {
        return {
            faces: registeredFaces.length,
            attendanceData: attendanceLog,
            exportDate: new Date().toISOString()
        };
    }
};

// Enhanced face recognition with adaptive thresholding
const FaceRecognition = {
    // Euclidean distance calculation
    euclideanDistance: (a, b) => {
        let sum = 0;
        for (let i = 0; i < a.length; i++) {
            sum += Math.pow(a[i] - b[i], 2);
        }
        return Math.sqrt(sum);
    },

    // Find best match with confidence scoring
    findBestMatch: (descriptor, threshold = CONFIG.RECOGNITION_THRESHOLD) => {
        if (!registeredFaces.length) return null;

        let bestMatch = { index: -1, distance: Infinity, confidence: 0 };

        for (let i = 0; i < registeredFaces.length; i++) {
            const distance = FaceRecognition.euclideanDistance(descriptor, registeredFaces[i].descriptor);

            if (distance < bestMatch.distance) {
                bestMatch = {
                    index: i,
                    distance: distance,
                    confidence: Math.max(0, 1 - distance)
                };
            }
        }

        if (bestMatch.distance < threshold) {
            return {
                ...registeredFaces[bestMatch.index],
                distance: bestMatch.distance,
                confidence: bestMatch.confidence
            };
        }

        return null;
    },

    // Check for duplicate faces during registration
    isDuplicateFace: (descriptor, threshold = 0.5) => {
        return registeredFaces.some(face => 
            FaceRecognition.euclideanDistance(descriptor, face.descriptor) < threshold
        );
    }
};

// Enhanced attendance management
const AttendanceManager = {
    mark: (person) => {
        try {
            const today = Utils.todayISO();

            if (!attendanceLog[today]) {
                attendanceLog[today] = [];
            }

            // Duplicate prevention
            const cutoffTime = Utils.timestamp() - (CONFIG.DUPLICATE_PREVENTION_MINUTES * 60 * 1000);
            const recentAttendance = attendanceLog[today].find(record => 
                (record.id === person.id || record.name === person.name) && 
                record.timestamp > cutoffTime
            );

            if (recentAttendance) {
                return { 
                    success: false, 
                    message: `Attendance already marked recently for ${person.name}`,
                    code: 'DUPLICATE_ATTENDANCE'
                };
            }

            // Add attendance record
            const record = {
                name: Utils.sanitizeInput(person.name),
                id: Utils.sanitizeInput(person.id || ''),
                time: Utils.timeNow(),
                timestamp: Utils.timestamp(),
                confidence: person.confidence || 0
            };

            attendanceLog[today].push(record);
            Database.save();

            return { 
                success: true, 
                message: `Attendance marked successfully for ${person.name}`,
                record: record
            };
        } catch (error) {
            console.error('Attendance marking error:', error);
            return { 
                success: false, 
                message: 'Failed to mark attendance',
                error: error.message 
            };
        }
    },

    getTodayRecords: () => {
        const today = Utils.todayISO();
        return attendanceLog[today] || [];
    },

    exportToCSV: (date = null) => {
        const targetDate = date || Utils.todayISO();
        const records = attendanceLog[targetDate] || [];

        if (!records.length) {
            throw new SmartAttendanceError('No records found for the specified date', 'NO_RECORDS');
        }

        const headers = ['Name', 'ID', 'Time'];
            csvContent = [
            headers.join(','),
            ...records.map(record => `"${record.name}","${record.id}","${record.time}"`)
        ].join('\n');


        return csvContent;
    }
};

// Enhanced model loading with retry logic
const ModelLoader = {
    modelsLoaded: false,
    loadPromise: null,

    load: async () => {
        if (ModelLoader.modelsLoaded) return { success: true };
        if (ModelLoader.loadPromise) return ModelLoader.loadPromise;

        ModelLoader.loadPromise = ModelLoader._loadWithRetry();
        return ModelLoader.loadPromise;
    },

    _loadWithRetry: async (retries = CONFIG.MAX_RETRIES) => {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(CONFIG.MODELS_PATH),
                    faceapi.nets.faceLandmark68Net.loadFromUri(CONFIG.MODELS_PATH),
                    faceapi.nets.faceRecognitionNet.loadFromUri(CONFIG.MODELS_PATH)
                ]);

                ModelLoader.modelsLoaded = true;
                return { success: true };
            } catch (error) {
                console.warn(`Model loading attempt ${attempt} failed:`, error);

                if (attempt === retries) {
                    return { 
                        success: false, 
                        error: `Failed to load models after ${retries} attempts: ${error.message}`
                    };
                }

                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }
};

// Performance monitoring
const PerformanceMonitor = {
    metrics: {},

    start: (operation) => {
        PerformanceMonitor.metrics[operation] = { start: performance.now() };
    },

    end: (operation) => {
        if (PerformanceMonitor.metrics[operation]) {
            PerformanceMonitor.metrics[operation].duration = 
                performance.now() - PerformanceMonitor.metrics[operation].start;
        }
    },

    getReport: () => {
        return { ...PerformanceMonitor.metrics };
    }
};

// Initialize on load
Database.load();

// Export API
window.SmartAttendance = {
    // Core data
    get registeredFaces() { return registeredFaces; },
    get attendanceLog() { return attendanceLog; },
    get settings() { return settings; },

    // Utilities
    Utils,
    Database,
    FaceRecognition,
    AttendanceManager,
    ModelLoader,
    PerformanceMonitor,

    // Legacy compatibility
    saveDB: Database.save,
    loadDB: Database.load,
    bestMatch: FaceRecognition.findBestMatch,
    markAttendanceRecord: AttendanceManager.mark,
    loadModelsUI: ModelLoader.load,

    // Configuration
    CONFIG,
    SmartAttendanceError
};
