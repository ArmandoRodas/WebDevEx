const API_BASE = "https://back-semprivado-umg-h6fkf2bng2avgrgw.westus3-01.azurewebsites.net/api";

// Estado de la aplicación
let allVideos = [];
let activeCategory = "todas";
let currentUser = JSON.parse(localStorage.getItem("edu_user")) || null;
let currentOpenVideo = null;

// Elementos DOM
const videoGrid = document.getElementById("videoGrid");
const categoryChips = document.getElementById("categoryChips");
const videoCountBadge = document.getElementById("videoCountBadge");
const galleryTitle = document.getElementById("galleryTitle");
const navAuthSection = document.getElementById("navAuthSection");

// Modales
const videoModal = document.getElementById("videoModal");
const authModal = document.getElementById("authModal");
const mainVideoPlayer = document.getElementById("mainVideoPlayer");

// Inicialización
document.addEventListener("DOMContentLoaded", () => {
  renderNavAuth();
  fetchCategories();
  fetchVideos();
  initCarneMask();
});

// ==========================================
// 1. CARGA DE DATOS (CATÁLOGO Y CATEGORÍAS)
// ==========================================

async function fetchCategories() {
  try {
    const res = await fetch(`${API_BASE}/videos/categorias`);
    if (res.ok) {
      const categorias = await res.json();
      renderCategoryChips(categorias);
    }
  } catch (e) {
    console.warn("No se pudieron cargar categorías desde endpoint específico, se extraerán de videos.");
  }
}

async function fetchVideos() {
  videoCountBadge.textContent = "Cargando videos...";
  try {
    const res = await fetch(`${API_BASE}/videos`);
    if (!res.ok) throw new Error("Error al obtener catálogo");
    allVideos = await res.json();

    // Si categorías no tenía endpoint o falló, extraerlas dinámicamente de allVideos
    if (categoryChips.children.length <= 1) {
      const uniqueCats = [...new Set(allVideos.map(v => v.categoria).filter(Boolean))];
      renderCategoryChips(uniqueCats);
    }

    renderVideos(allVideos);
  } catch (err) {
    videoGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #ef4444;">
        ⚠️ Error al conectar con el servidor de videos. Verifica tu conexión.
      </div>
    `;
    videoCountBadge.textContent = "0 videos";
  }
}

function renderCategoryChips(categorias) {
  categoryChips.innerHTML = `<button class="chip ${activeCategory === 'todas' ? 'active' : ''}" onclick="filterByCategory('todas')">Todas</button>`;
  categorias.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = `chip ${activeCategory === cat ? 'active' : ''}`;
    btn.textContent = cat;
    btn.onclick = () => filterByCategory(cat);
    categoryChips.appendChild(btn);
  });
}

// ==========================================
// 2. FILTRADO Y BÚSQUEDA EN TIEMPO REAL
// ==========================================

function filterByCategory(cat) {
  activeCategory = cat;
  document.querySelectorAll(".chip").forEach(c => {
    c.classList.toggle("active", c.textContent.trim().toLowerCase() === cat.toLowerCase());
  });

  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  applyFilters(query, cat);
}

function handleSearch(query) {
  applyFilters(query.trim().toLowerCase(), activeCategory);
}

function applyFilters(query, category) {
  let filtered = allVideos.filter(video => {
    const matchCategory = category === "todas" || video.categoria?.toLowerCase() === category.toLowerCase();
    const matchQuery = !query || 
      video.titulo.toLowerCase().includes(query) || 
      (video.descripcion && video.descripcion.toLowerCase().includes(query));
    return matchCategory && matchQuery;
  });

  galleryTitle.textContent = category === "todas" ? "Todos los Videos" : `Videos de: ${category}`;
  renderVideos(filtered);
}

// ==========================================
// 3. RENDERIZADO DE LA GALERÍA (TARJETAS)
// ==========================================

function renderVideos(videos) {
  videoCountBadge.textContent = `${videos.length} video${videos.length === 1 ? '' : 's'}`;

  if (videos.length === 0) {
    videoGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 50px 20px; color: #9ca3af;">
        <p style="font-size: 1.1rem; margin-bottom: 6px;">No se encontraron videos con ese criterio.</p>
        <small>Intenta con otra categoría o término de búsqueda.</small>
      </div>
    `;
    return;
  }

  videoGrid.innerHTML = videos.map(video => `
    <article class="video-card" onclick="openVideoPlayer(${video.id})">
      <div class="card-thumb-wrapper">
        <img class="card-thumb" src="${video.poster || 'https://placehold.co/600x400/23252a/white?text=Video'}" alt="${video.titulo}" loading="lazy" />
        <span class="thumb-duration">${video.duracion || '00:00'}</span>
        <div class="thumb-play-overlay">
          <span class="thumb-play-icon">▶</span>
        </div>
      </div>
      <div class="card-body">
        <span class="card-category">${video.categoria || 'General'}</span>
        <h3 class="card-title">${video.titulo}</h3>
        <p class="card-desc">${video.descripcion || ''}</p>
        <div class="card-footer">
          <span>❤️ ${video.likes || 0} Likes</span>
          <span>💬 ${(video.comentarios && video.comentarios.length) || 0} Comentarios</span>
        </div>
      </div>
    </article>
  `).join("");
}

// ==========================================
// 4. REPRODUCTOR Y CONTROL DE ACCESO
// ==========================================

function openVideoPlayer(videoId) {
  const video = allVideos.find(v => v.id === videoId);
  if (!video) return;

  currentOpenVideo = video;

  // Cargar multimedia
  mainVideoPlayer.src = video.urlVideo;
  mainVideoPlayer.poster = video.poster;
  mainVideoPlayer.load();

  // Datos
  document.getElementById("modalTitle").textContent = video.titulo;
  document.getElementById("modalDescription").textContent = video.descripcion || "Sin descripción disponible.";
  document.getElementById("modalCategory").textContent = video.categoria || "General";
  document.getElementById("modalDuration").textContent = `Duración: ${video.duracion || '00:00'}`;
  document.getElementById("modalLikesCount").textContent = video.likes || 0;

  // Estado del Like
  const btnLike = document.getElementById("btnLike");
  const authNotice = document.getElementById("authNotice");
  const isLiked = currentUser && video.usuariosLikes && (
    video.usuariosLikes.includes(currentUser.carne) || 
    video.usuariosLikes.includes(currentUser.usuario)
  );

  btnLike.classList.toggle("liked", !!isLiked);

  if (!currentUser) {
    authNotice.classList.remove("hidden");
  } else {
    authNotice.classList.add("hidden");
  }

  // Renderizar comentarios y caja de entrada
  renderModalComments(video);

  videoModal.classList.remove("hidden");
  mainVideoPlayer.play().catch(() => {}); // Autoplay seguro
}

function closeVideoModal() {
  mainVideoPlayer.pause();
  mainVideoPlayer.src = "";
  videoModal.classList.add("hidden");
  currentOpenVideo = null;
}

function handleLikeClick() {
  if (!currentUser) {
    alert("Debes iniciar sesión para dar 'Me gusta'.");
    openAuthModal('login');
    return;
  }

  // Comportamiento visual de like para el usuario autenticado
  const video = currentOpenVideo;
  if (!video) return;

  if (!video.usuariosLikes) video.usuariosLikes = [];
  const userIdentifier = currentUser.carne || currentUser.usuario;
  const index = video.usuariosLikes.indexOf(userIdentifier);

  if (index === -1) {
    video.usuariosLikes.push(userIdentifier);
    video.likes = (video.likes || 0) + 1;
  } else {
    video.usuariosLikes.splice(index, 1);
    video.likes = Math.max(0, (video.likes || 0) - 1);
  }

  document.getElementById("modalLikesCount").textContent = video.likes;
  document.getElementById("btnLike").classList.toggle("liked", video.usuariosLikes.includes(userIdentifier));
  renderVideos(allVideos);
}

function renderModalComments(video) {
  const comments = video.comentarios || [];
  document.getElementById("modalCommentCount").textContent = comments.length;

  const newCommentBox = document.getElementById("newCommentBox");
  if (!currentUser) {
    newCommentBox.innerHTML = `
      <div class="comment-guest-lock">
        🔒 Para participar y dejar un comentario, 
        <a onclick="openAuthModal('login')">inicia sesión aquí</a> o 
        <a onclick="openAuthModal('register')">regístrate</a>.
      </div>
    `;
  } else {
    newCommentBox.innerHTML = `
      <div class="comment-input-area">
        <textarea id="commentInputText" placeholder="Escribe tu comentario sobre este video como ${currentUser.estudiante || currentUser.usuario}..."></textarea>
        <button class="btn-primary-sm" style="align-self: flex-end;" onclick="postComment()">Publicar Comentario</button>
      </div>
    `;
  }

  const list = document.getElementById("commentsList");
  if (comments.length === 0) {
    list.innerHTML = `<p style="color: #6b7280; font-size: 0.88rem; font-style: italic;">Aún no hay comentarios en este video.</p>`;
    return;
  }

  list.innerHTML = comments.map(c => `
    <div class="comment-item">
      <div class="comment-header">
        <span class="comment-author">👤 ${c.estudiante || c.carne}</span>
        <span class="comment-date">${c.fecha || ''}</span>
      </div>
      <div class="comment-body">${c.texto}</div>
      ${c.respuestas && c.respuestas.length > 0 ? `
        <div class="replies-list">
          ${c.respuestas.map(r => `
            <div class="reply-item">
              <span class="comment-author">↳ ${r.estudiante || r.carne}:</span>
              <span>${r.texto}</span>
            </div>
          `).join("")}
        </div>
      ` : ''}
    </div>
  `).join("");
}

function postComment() {
  const text = document.getElementById("commentInputText").value.trim();
  if (!text) return;

  const newComment = {
    id: Date.now(),
    carne: currentUser.carne || "0000-00-00000",
    estudiante: currentUser.estudiante || currentUser.usuario,
    texto: text,
    fecha: new Date().toISOString().replace('T', ' ').substring(0, 19),
    respuestas: []
  };

  if (!currentOpenVideo.comentarios) currentOpenVideo.comentarios = [];
  currentOpenVideo.comentarios.unshift(newComment);

  renderModalComments(currentOpenVideo);
  renderVideos(allVideos);
}

// ==========================================
// 5. GESTIÓN DE SESIÓN Y MODAL DE AUTH
// ==========================================

function renderNavAuth() {
  if (currentUser) {
    const displayName = currentUser.estudiante || currentUser.usuario;
    navAuthSection.innerHTML = `
      <div class="user-badge">
        <span class="user-icon">👤</span>
        <span>${displayName}</span>
      </div>
      <button class="btn-logout" onclick="logout()">Salir</button>
    `;
  } else {
    navAuthSection.innerHTML = `
      <button class="btn-primary-sm" onclick="openAuthModal('login')">Iniciar Sesión</button>
      <button class="btn-secondary-sm" onclick="openAuthModal('register')">Registrarse</button>
    `;
  }
}

function openAuthModal(tab = 'login') {
  authModal.classList.remove("hidden");
  switchTab(tab);
}

function closeAuthModal() {
  authModal.classList.add("hidden");
}

function switchTab(tab) {
  clearAlert();
  const tabLoginBtn = document.getElementById("tabLoginBtn");
  const tabRegisterBtn = document.getElementById("tabRegisterBtn");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

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

function showAlert(message, type = "error") {
  const alertBox = document.getElementById("alertBox");
  alertBox.textContent = message;
  alertBox.className = `alert ${type}`;
  alertBox.classList.remove("hidden");
}

function clearAlert() {
  const alertBox = document.getElementById("alertBox");
  alertBox.textContent = "";
  alertBox.className = "alert hidden";
}

function initCarneMask() {
  const carneInput = document.getElementById("regCarne");
  if (!carneInput) return;
  carneInput.addEventListener("input", (e) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length > 11) val = val.substring(0, 11);
    let formatted = "";
    if (val.length > 0) {
      formatted = val.substring(0, 4);
      if (val.length > 4) formatted += "-" + val.substring(4, 6);
      if (val.length > 6) formatted += "-" + val.substring(6, 11);
    }
    e.target.value = formatted;
  });
}

// ENVÍO DE REGISTRO
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
      showAlert("¡Registro exitoso! Iniciando automáticamente...", "success");
      currentUser = { carne, estudiante, correo };
      localStorage.setItem("edu_user", JSON.stringify(currentUser));
      setTimeout(() => {
        closeAuthModal();
        renderNavAuth();
        if (currentOpenVideo) openVideoPlayer(currentOpenVideo.id);
      }, 1200);
    } else {
      const errorMsg = (data && (data.message || data.error)) || "Error al registrar estudiante.";
      showAlert(errorMsg, "error");
    }
  } catch (err) {
    showAlert("Error de conexión al registrar.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Registrar Estudiante";
  }
}

// ENVÍO DE LOGIN
async function handleLogin(event) {
  event.preventDefault();
  clearAlert();

  const usuario = document.getElementById("loginUser").value.trim();
  const password = document.getElementById("loginPass").value.trim();

  const pinRegex = /^[0-9]+$/;
  if (!pinRegex.test(password)) {
    showAlert("La contraseña debe ser numérica.");
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
      showAlert("¡Bienvenido!", "success");
      
      let nombre = usuario;
      if (data) {
        if (typeof data.estudiante === "string") nombre = data.estudiante;
        else if (data.usuario && typeof data.usuario.estudiante === "string") nombre = data.usuario.estudiante;
        else if (data.nombre && typeof data.nombre === "string") nombre = data.nombre;
      }

      currentUser = {
        usuario,
        estudiante: nombre,
        carne: usuario.includes("@") ? "" : usuario
      };
      localStorage.setItem("edu_user", JSON.stringify(currentUser));

      setTimeout(() => {
        closeAuthModal();
        renderNavAuth();
        if (currentOpenVideo) openVideoPlayer(currentOpenVideo.id);
      }, 900);
    } else {
      const errorMsg = (data && (data.message || data.error)) || "Credenciales incorrectas.";
      showAlert(errorMsg, "error");
    }
  } catch (err) {
    showAlert("Error al iniciar sesión.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Entrar a la Plataforma";
  }
}

function logout() {
  localStorage.removeItem("edu_user");
  currentUser = null;
  renderNavAuth();
  if (currentOpenVideo) openVideoPlayer(currentOpenVideo.id);
}