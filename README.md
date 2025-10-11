# SmartAttendance – In-Browser Attendance System

SmartAttendance is a **minimal, in-browser face recognition attendance system** built using **face-api.js**. It allows students to register their ID photos and mark attendance via webcam. The project is designed for Hacktoberfest contributions, and as a foundation for more advanced attendance solutions.

---

## 🚀 Features (MVP)

- **Home Page (`index.html`)** – Overview & navigation.  
- **Register Students (`register.html`)**  
  - Upload a student ID photo to register a student.  
  - Enter **name** and **ID number** (optional for now).  
  - Detects face from the uploaded image using `face-api.js`.  
  - Prevents duplicate registrations based on face similarity.  
- **Take Attendance (`attendance.html`)**  
  - Mark attendance in real-time using webcam.  
  - Recognizes registered faces and logs attendance.  
  - Shows a list of students marked present for the current day.  
  - Export attendance as CSV.  

> **Note:** Currently, student name and ID verification against the photo is not implemented. The ID field is optional in this MVP.  

---

## 🛠 Tech Stack

- **Frontend:** HTML, CSS, JavaScript  
- **Face Recognition:** [face-api.js](https://github.com/justadudewhohacks/face-api.js)  
- **Data Storage:** `localStorage` (browser-based)  
- **Optional Future Backend:** Contributors can implement MongoDB / Node.js for persistent, multi-user storage.

---

## 📦 Project Structure

```
├── index.html # Home page
├── register.html # Register students
├── attendance.html # Take attendance
├── style.css # Shared styles
├── common.js # Shared utilities & model loader
├── register.js # Student registration logic
├── attendance.js # Attendance & webcam logic
├── models/ # face-api.js models
└── README.md
```

---

## 📝 Usage

1. Serve the project over **HTTP(S)** (Chrome blocks webcam & model requests on `file://`).  
2. Open `index.html` in your browser.  
3. Go to **Register** page to register students with their ID photo.  
4. Go to **Attendance** page to mark attendance using webcam.  
5. Export attendance as CSV if needed.  

---

## 🤝 Contribution

This project is perfect for Hacktoberfest!  

> Please follow standard contribution practices: fork → branch → PR → review.

---

## ⚠️ Limitations (Current MVP)

- Attendance recognition sometimes shows **"Unknown Face"** due to lighting or camera issues.  
- Student name and ID are **not verified against the uploaded photo**.  
- Data is **stored only in localStorage**, so multi-browser / multi-user sync is not supported.  

---

## 🎯 Future Improvements

- Integrate backend (MongoDB/Express) for persistent multi-user attendance logs.  
- Use OCR to verify ID numbers and names.  
- Improve recognition thresholds and lighting robustness.  
- Better UI/UX for registered students, attendance logs, and notifications.  
- Mobile support and multi-device recognition.


If you are new to Open source, u may refer to [This Guideline](https://medium.com/@saumyayadav213/kickstart-your-open-source-journey-with-gssoc-no-experience-needed-39f5934418a0)

![Hacktoberfest](https://img.shields.io/badge/Hacktoberfest-2025-blue)
![License: MIT](https://img.shields.io/badge/License-MIT-green)
![Issues](https://img.shields.io/github/issues/saumyayadav25/hacktoberfest)
## How to Contribute

1. Fork this repository
2. Clone it locally
3. Create a new branch
4. Make your changes (code, docs, or examples)
5. Push your branch
6. Open a Pull Request
