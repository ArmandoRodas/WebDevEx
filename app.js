const API_BASE = "https://back-semprivado-umg-h6fkf2bng2avgrgw.westus3-01.azurewebsites.net/api";

// Elementos UI
const tabLoginBtn = document.getElementById("tabLoginBtn");
const tabRegisterBtn = document.getElementById("tabRegisterBtn");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const alertBox = document.getElementById("alertBox");
const sessionPanel = document.getElementById("sessionPanel");
const sessionGreeting = document.getElementById("sessionGreeting");
const sessionInfo = document.getElementById("sessionInfo");

// 1. Alternar pestañas
function switchTab(tab) {
  clearAlert();
  if (tab === "login") {
    tabLoginBtn.classList.add("active");
    tabRegisterBtn.classList.remove("active");
    loginForm.classList.add("active");
    registerForm.classList.remove("active");
  } else {
    tabRegisterBtn.classList.add("active");
    tabLoginBtn.classList.remove("active");
    registerForm.classList.add("active");
    loginForm.classList.remove("active");
  }
}

// 2. Máscara interactiva carné: 9999-99-99999
const carneInput = document.getElementById("regCarne");
if (carneInput) {
  carneInput.addEventListener("input", (e) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length > 11) val = val.substring(0, 11);

    let formatted = "";
    if (val.length > 0) {
      formatted = val.substring(0, 4);
      if (val.length > 4) {
        formatted += "-" + val.substring(4, 6);
        if (val.length > 6) {
          formatted += "-" + val.substring(6, 11);
        }
      }
    }
    e.target.value = formatted;
  });
}

// 3. Manejo de Alertas
function showAlert(message, type = "error") {
  alertBox.textContent = message;
  alertBox.className = `alert ${type}`;
  alertBox.classList.remove("hidden");
}

function clearAlert() {
  alertBox.textContent = "";
  alertBox.className = "alert hidden";
}

// 4. ENVÍO: REGISTRO
async function handleRegister(event) {
  event.preventDefault();
  clearAlert();

  const carne = document.getElementById("regCarne").value.trim();
  const estudiante = document.getElementById("regName").value.trim();
  const correo = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPass").value.trim();

  const carneRegex = /^[0-9]{4}-[0-9]{2}-[0-9]{5}$/;
  if (!carneRegex.test(carne)) {
    showAlert("El carné debe cumplir con el formato 9999-99-99999.");
    return;
  }

  const pinRegex = /^[0-9]+$/;
  if (!pinRegex.test(password)) {
    showAlert("La contraseña debe ser un PIN estrictamente numérico.");
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(correo)) {
    showAlert("Ingresa un correo electrónico válido.");
    return;
  }

  const submitBtn = document.getElementById("btnRegSubmit");
  submitBtn.disabled = true;
  submitBtn.textContent = "Registrando...";

  try {
    const response = await fetch(`${API_BASE}/estudiantes/registrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carne, estudiante, correo, password })
    });

    const data = await response.json().catch(() => null);

    if (response.ok || response.status === 201) {
      showAlert("¡Estudiante registrado con éxito! Ahora inicia sesión.", "success");
      registerForm.reset();
      setTimeout(() => switchTab("login"), 1600);
    } else {
      const errorMsg = (data && (data.message || data.error)) || "Error al registrar el estudiante.";
      showAlert(errorMsg, "error");
    }
  } catch (err) {
    showAlert("Error de conexión al servidor.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Registrar Estudiante";
  }
}

// 5. ENVÍO: INICIO DE SESIÓN
async function handleLogin(event) {
  event.preventDefault();
  clearAlert();

  const usuario = document.getElementById("loginUser").value.trim();
  const password = document.getElementById("loginPass").value.trim();

  const pinRegex = /^[0-9]+$/;
  if (!pinRegex.test(password)) {
    showAlert("La contraseña debe ser un PIN estrictamente numérico.");
    return;
  }

  const submitBtn = document.getElementById("btnLoginSubmit");
  submitBtn.disabled = true;
  submitBtn.textContent = "Verificando...";

  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, password })
    });

    const data = await response.json().catch(() => null);

    if (response.ok || response.status === 200) {
      showAlert("Inicio de sesión exitoso.", "success");

      document.querySelector(".tabs").classList.add("hidden");
      loginForm.classList.remove("active");
      registerForm.classList.remove("active");

      // Corrección del [object Object]:
      // Extrae la propiedad de texto si data es un objeto anidado
      let nombreMostrado = usuario;
      if (data) {
        if (typeof data.estudiante === "string") {
          nombreMostrado = data.estudiante;
        } else if (data.usuario && typeof data.usuario.estudiante === "string") {
          nombreMostrado = data.usuario.estudiante;
        } else if (data.nombre && typeof data.nombre === "string") {
          nombreMostrado = data.nombre;
        }
      }

      sessionGreeting.textContent = `¡Hola, ${nombreMostrado}!`;
      sessionInfo.textContent = `Has iniciado sesión correctamente en el catálogo educativo.`;
      sessionPanel.classList.remove("hidden");
    } else {
      const errorMsg = (data && (data.message || data.error)) || "Credenciales incorrectas.";
      showAlert(errorMsg, "error");
    }
  } catch (err) {
    showAlert("Error de conexión al servidor.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Entrar a la Plataforma";
  }
}

// 6. Cerrar Sesión
function logout() {
  sessionPanel.classList.add("hidden");
  document.querySelector(".tabs").classList.remove("hidden");
  switchTab("login");
  clearAlert();
  document.getElementById("loginPass").value = "";
}