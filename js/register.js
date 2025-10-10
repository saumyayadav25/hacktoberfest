document.addEventListener('DOMContentLoaded', ()=>{
  const nameInput = document.getElementById('userName');
  const idInput = document.getElementById('userIdNumber');
  const fileInput = document.getElementById('idImageInput');
  const img = document.getElementById('idImage');
  const result = document.getElementById('registerResult');
  const regList = document.getElementById('registeredList');
  const btn = document.getElementById('extractBtn');
  const form = document.getElementById('registerForm');
  const modal = document.getElementById('modal');
  const modalMessage = document.getElementById('modalMessage');
  const modalClose = document.getElementById('modalClose');

  function showModal(msg){ modalMessage.innerText = msg; modal.classList.remove('hidden'); }
  modalClose.addEventListener('click', ()=> modal.classList.add('hidden'));

  function loadDBAndConvert(){
    SmartAttendance.loadDB();
    SmartAttendance.registeredFaces.forEach(st=>{
      st.descriptor = new Float32Array(st.descriptor);
    });
  }

  function refreshList(){
    loadDBAndConvert();
    const arr = SmartAttendance.registeredFaces;
    regList.innerHTML = '';
    if(!arr.length) regList.innerHTML = '<div class="item">No students registered yet</div>';
    arr.forEach(st => {
      const d = document.createElement('div');
      d.className='item';
      d.innerText = `${st.name} ${st.id? '('+st.id+')':''}`;
      regList.appendChild(d);
    });
  }

  refreshList();

  fileInput.addEventListener('change', (e)=>{
    const f = e.target.files[0]; 
    if(!f) return; 
    img.src = URL.createObjectURL(f);
  });

  // Handle form submission (prevents default submit and runs the registration flow)
  form?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const name = nameInput.value.trim(); 
    const id = idInput.value.trim();
    if(!name) return result.innerText = 'Enter name first';
    if(!fileInput.files[0]) return result.innerText = 'Choose an image file';

    result.innerText = 'Loading models...';
    const ok = await SmartAttendance.loadModelsUI();
    if(!ok) return result.innerText = 'Model load failed';

    result.innerText = 'Detecting face...';
    try{
      const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
                                      .withFaceLandmarks()
                                      .withFaceDescriptor();
      if(!detection) return result.innerText = 'No face found in image';

      loadDBAndConvert();

      // duplicate name
      const nameDup = SmartAttendance.registeredFaces.some(st => st.name.toLowerCase() === name.toLowerCase());
      if(nameDup){ showModal('Student already registered with this name'); return; }

      // duplicate face
      const isDuplicateFace = SmartAttendance.registeredFaces.some(st=>{
        return faceapi.euclideanDistance(st.descriptor, detection.descriptor) < 0.6;
      });
      if(isDuplicateFace){ showModal('This face is already registered'); return; }

      // add student
      const newStudent = {
        name,
        id,
        descriptor: Array.from(detection.descriptor)
      };
      SmartAttendance.registeredFaces.push(newStudent);
      SmartAttendance.saveDB();

      result.innerText = `Registered ${name}`;
      showModal(`${name} registered successfully`);
      refreshList();

    }catch(e){ console.error(e); result.innerText = 'Error during registration'; }
  });

});
