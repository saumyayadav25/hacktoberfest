// This function sends data to backend server.
async function saveStudentToDatabase(studentName, studentID) {
    try {
        const response = await fetch('http://localhost:3000/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: studentName, studentId: studentID }),
        });

        if (response.ok) {
            console.log('Student data saved successfully to the database.');
            alert('Student registered and saved to the database!');
            return true; // ✅ Return success status
        } else {
            console.error('Failed to save student to the database.');
            return false;
        }
    } catch (error) {
        console.error('Error connecting to the server:', error);
        return false;
    }
}

// Function to fetch and display registered students
async function fetchAndDisplayRegisteredStudents() {
    try {
        const response = await fetch('http://localhost:3000/api/student');
        const registeredList = document.getElementById('registeredList');

        if (response.ok) {
            const students = await response.json();

            // Handle both single student (old format) and multiple students (new format)
            const studentsArray = Array.isArray(students) ? students : [students];

            if (studentsArray.length === 0) {
                registeredList.innerHTML = '<div class="no-students">No students registered yet.</div>';
                return;
            }

            registeredList.innerHTML = studentsArray.map(student => `
                <div class="student-item">
                    <strong>${student.name}</strong> (ID: ${student.studentId})
                    <br>
                    <small>Registered: ${new Date(student.registeredAt).toLocaleString()}</small>
                </div>
            `).join('');

        } else if (response.status === 404) {
            registeredList.innerHTML = '<div class="no-students">No students registered yet.</div>';
        } else {
            registeredList.innerHTML = '<div class="error">Error loading registered students.</div>';
        }
    } catch (error) {
        console.error('Error fetching registered students:', error);
        document.getElementById('registeredList').innerHTML = '<div class="error">Error loading registered students.</div>';
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const nameInput = document.getElementById('userName');
    const idInput = document.getElementById('userIdNumber');
    const fileInput = document.getElementById('idImageInput');
    const img = document.getElementById('idImage');
    const result = document.getElementById('registerResult');
    const btn = document.getElementById('extractBtn');
    const modal = document.getElementById('modal');
    const modalMessage = document.getElementById('modalMessage');
    const modalClose = document.getElementById('modalClose');

    // Loads registered students when page loads
    fetchAndDisplayRegisteredStudents();

    function showModal(msg) {
        modalMessage.innerText = msg;
        modal.classList.remove('hidden');
    }

    modalClose.addEventListener('click', () => modal.classList.add('hidden'));

    fileInput.addEventListener('change', (e) => {
        const f = e.target.files[0];
        if (!f) return;
        img.src = URL.createObjectURL(f);
    });

    btn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        const id = idInput.value.trim();

        if (!name) {
            result.innerText = 'Enter name first';
            return;
        }

        if (!fileInput.files[0]) {
            result.innerText = 'Choose an image file';
            return;
        }

        result.innerText = 'Loading models...';

        // Note: SmartAttendance.loadModelsUI() is still needed from common.js
        const ok = await window.SmartAttendance.loadModelsUI();
        if (!ok) {
            result.innerText = 'Model load failed';
            return;
        }

        result.innerText = 'Detecting face...';

        try {
            const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) {
                result.innerText = 'No face found in image';
                return;
            }

            // Call the function to save data to the server
            const saveSuccess = await saveStudentToDatabase(name, id);

            if (saveSuccess) {
                result.innerText = `Registered ${name}`;
                showModal(`${name} registered successfully`);

                // Clears the form after successful registration
                nameInput.value = '';
                idInput.value = '';
                fileInput.value = '';
                img.src = '';

                // Updates the registered students list
                await fetchAndDisplayRegisteredStudents();
            } else {
                result.innerText = 'Registration failed - server error';
            }

        } catch (e) {
            console.error(e);
            result.innerText = 'Error during registration';
        }
    });
});
