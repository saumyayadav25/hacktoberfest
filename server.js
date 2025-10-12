// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware to allow cross-origin requests and parse JSON
app.use(cors());
app.use(express.json());

// ✅ ADD THIS: Serve static files (including model files)
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Optional: Serve models from a specific route
app.use('/models', express.static(path.join(__dirname, 'models')));

// --- Connect to MongoDB ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected successfully.'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Create a Data Schema for Students ---
const studentSchema = new mongoose.Schema({
    name: String,
    studentId: String,
    registeredAt: { type: Date, default: Date.now }
});
const Student = mongoose.model('Student', studentSchema);

// --- API Endpoints (Routes) ---

// POST: Register a new student
app.post('/api/register', async (req, res) => {
    try {
        // Since only one student's data should persist, clear old data first
        await Student.deleteMany({});
        const newStudent = new Student({
            name: req.body.name,
            studentId: req.body.studentId
        });
        await newStudent.save();
        res.status(201).json(newStudent);
    } catch (error) {
        res.status(500).json({ message: 'Error registering student', error });
    }
});

// GET: Retrieve the currently registered student
app.get('/api/student', async (req, res) => {
    try {
        const student = await Student.findOne().sort({ registeredAt: -1 }); // Get the latest one
        if (student) {
            res.status(200).json(student);
        } else {
            res.status(404).json({ message: 'No student is currently registered.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error fetching student', error });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`📁 Static files served from: ${path.join(__dirname, 'public')}`);
    console.log(`🤖 Models available at: http://localhost:${PORT}/models/`);
});
