// This function sends data to your new backend server.
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
        } else {
            console.error('Failed to save student to the database.');
        }
    } catch (error) {
        console.error('Error connecting to the server:', error);
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
            // Fixed: Removed the malformed character before TinyFaceDetectorOptions
            const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) {
                result.innerText = 'No face found in image';
                return;
            }

            // Call the function to save data to the server
            await saveStudentToDatabase(name, id);

            result.innerText = `Registered ${name}`;
            showModal(`${name} registered successfully`);

        } catch (e) {
            console.error(e);
            result.innerText = 'Error during registration';
        }
    });
});
