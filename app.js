const API_BASE = "https://back-semprivado-umg-h6fkf2bng2avgrgw.westus3-01.azurewebsites.net/api";

let allVideos = [];
let activeCategory = "todas";
let currentUser = JSON.parse(localStorage.getItem("edu_user")) || null;
let currentOpenVideo = null;
let activeReplyCommentId = null;

const videoGrid = document.getElementById("videoGrid");
const categoryChips = document.getElementById("categoryChips");
const videoCountBadge = document.getElementById("videoCountBadge");
const galleryTitle = document.getElementById("galleryTitle");
const navAuthSection = document.getElementById("navAuthSection");
const videoModal = document.getElementById("videoModal");
const authModal = document.getElementById("authModal");
const mainVideoPlayer = document.getElementById("mainVideoPlayer");

document.addEventListener("DOMContentLoaded", () => {
  renderNavAuth();
  fetchCategories();
  fetchVideos();
  initCarneMask();
});

// Consumo de catálogo y categorías
async function fetchCategories() {
  try {
    const res = await fetch(`${API_BASE}/videos/categorias`);
    if (res.ok) {
      const categorias = await res.json();
      renderCategoryChips(categorias);
    }
  } catch (e) {
    console.warn("Fallo carga de categorias desde endpoint:", e);
  }
}

async function fetchVideos() {
  videoCountBadge.textContent = "Cargando videos...";
  try {
    const res = await fetch(`${API_BASE}/videos`);
    if (!res.ok) throw new Error("Error en petición");
    allVideos = await res.json();

    if (categoryChips.children.length <= 1) {
      const uniqueCats = [...new Set(allVideos.map(v => v.categoria).filter(Boolean))];
      renderCategoryChips(uniqueCats);
    }

    renderVideos(allVideos);
  } catch (err) {
    videoGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #ef4444;">
        Error al conectar con el servidor de videos.
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

function renderVideos(videos) {
  videoCountBadge.textContent = `${videos.length} video${videos.length === 1 ? '' : 's'}`;

  if (videos.length === 0) {
    videoGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 50px 20px; color: #9ca3af;">
        <p style="font-size: 1.1rem; margin-bottom: 6px;">No se encontraron videos con ese criterio.</p>
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

// Reproductor multimedia y sincronización de estado
async function openVideoPlayer(videoId) {
  const localVideo = allVideos.find(v => v.id === videoId);
  if (!localVideo) return;

  currentOpenVideo = localVideo;
  activeReplyCommentId = null;

  mainVideoPlayer.src = localVideo.urlVideo;
  mainVideoPlayer.poster = localVideo.poster;
  mainVideoPlayer.load();

  document.getElementById("modalTitle").textContent = localVideo.titulo;
  document.getElementById("modalDescription").textContent = localVideo.descripcion || "";
  document.getElementById("modalCategory").textContent = localVideo.categoria || "General";
  document.getElementById("modalDuration").textContent = `Duración: ${localVideo.duracion || '00:00'}`;

  updateModalInteractionState(localVideo);
  renderModalComments(localVideo);

  videoModal.classList.remove("hidden");
  mainVideoPlayer.play().catch(() => {});

  try {
    const res = await fetch(`${API_BASE}/videos/${videoId}`);
    if (res.ok) {
      const freshVideo = await res.json();
      currentOpenVideo = freshVideo;
      const idx = allVideos.findIndex(v => v.id === videoId);
      if (idx !== -1) allVideos[idx] = freshVideo;
      updateModalInteractionState(freshVideo);
      renderModalComments(freshVideo);
    }
  } catch (e) {
    console.warn("Fallo sincronización individual de video:", e);
  }
}

function getValidCarne() {
  if (!currentUser) return null;
  if (currentUser.carne && !currentUser.carne.includes("@")) return currentUser.carne;
  if (currentUser.usuario && !currentUser.usuario.includes("@")) return currentUser.usuario;
  const promptCarne = prompt("Ingresa tu número de carné para registrar la acción (ej: 1890-20-11489):");
  if (promptCarne) {
    currentUser.carne = promptCarne.trim();
    localStorage.setItem("edu_user", JSON.stringify(currentUser));
    return currentUser.carne;
  }
  return null;
}

function updateModalInteractionState(video) {
  document.getElementById("modalLikesCount").textContent = video.likes || 0;
  const btnLike = document.getElementById("btnLike");
  const authNotice = document.getElementById("authNotice");

  const carne = currentUser ? (currentUser.carne || currentUser.usuario) : null;
  const isLiked = carne && video.usuariosLikes && video.usuariosLikes.includes(carne);

  btnLike.classList.toggle("liked", !!isLiked);
  authNotice.classList.toggle("hidden", !!currentUser);
}

function closeVideoModal() {
  mainVideoPlayer.pause();
  mainVideoPlayer.src = "";
  videoModal.classList.add("hidden");
  currentOpenVideo = null;
  activeReplyCommentId = null;
}

// SERIE III: Endpoints de interacción
async function handleLikeClick() {
  if (!currentUser) {
    alert("Debes iniciar sesión para dar 'Me gusta'.");
    openAuthModal('login');
    return;
  }

  const video = currentOpenVideo;
  if (!video) return;

  const carne = getValidCarne();
  if (!carne) return;

  const btnLike = document.getElementById("btnLike");
  btnLike.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/interaccionvideo/${video.id}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carne })
    });

    if (res.ok) {
      if (!video.usuariosLikes) video.usuariosLikes = [];
      const idx = video.usuariosLikes.indexOf(carne);
      if (idx === -1) {
        video.usuariosLikes.push(carne);
        video.likes = (video.likes || 0) + 1;
      } else {
        video.usuariosLikes.splice(idx, 1);
        video.likes = Math.max(0, (video.likes || 0) - 1);
      }
      updateModalInteractionState(video);
      renderVideos(allVideos);
    } else {
      const errText = await res.text();
      console.error("Fallo API Like:", res.status, errText);
      alert("No se pudo registrar el like. Verifica que el carné sea válido.");
    }
  } catch (e) {
    alert("Error de conexión al enviar like.");
  } finally {
    btnLike.disabled = false;
  }
}

async function postComment() {
  if (!currentUser) {
    openAuthModal('login');
    return;
  }

  const textInput = document.getElementById("commentInputText");
  const texto = textInput.value.trim();
  if (!texto) return;

  const video = currentOpenVideo;
  if (!video) return;

  const carne = getValidCarne();
  if (!carne) return;

  const submitBtn = document.getElementById("btnSubmitComment");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Publicando...";
  }

  try {
    const res = await fetch(`${API_BASE}/interaccionvideo/${video.id}/comentario`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carne, texto })
    });

    if (res.ok) {
      const newComment = {
        id: Date.now(),
        carne,
        estudiante: currentUser.estudiante || carne,
        texto,
        fecha: new Date().toISOString().replace('T', ' ').substring(0, 19),
        respuestas: []
      };

      if (!video.comentarios) video.comentarios = [];
      video.comentarios.unshift(newComment);
      renderModalComments(video);
      renderVideos(allVideos);
      textInput.value = "";
    } else {
      const errText = await res.text();
      console.error("Fallo API Comentario:", res.status, errText);
      alert("Error al publicar comentario.");
    }
  } catch (e) {
    alert("Error de conexión al publicar comentario.");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Publicar Comentario";
    }
  }
}

function toggleReplyBox(comentarioId) {
  if (!currentUser) {
    openAuthModal('login');
    return;
  }
  activeReplyCommentId = activeReplyCommentId === comentarioId ? null : comentarioId;
  renderModalComments(currentOpenVideo);
}

async function sendReply(comentarioId) {
  const replyInput = document.getElementById(`replyInput_${comentarioId}`);
  if (!replyInput) return;

  const texto = replyInput.value.trim();
  if (!texto) return;

  const carne = getValidCarne();
  if (!carne) return;

  try {
    const res = await fetch(`${API_BASE}/interaccionvideo/comentario/${comentarioId}/responder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carne, texto })
    });

    if (res.ok) {
      const targetComment = currentOpenVideo.comentarios.find(c => c.id === comentarioId);
      if (targetComment) {
        if (!targetComment.respuestas) targetComment.respuestas = [];
        targetComment.respuestas.push({
          id: Date.now(),
          carne,
          estudiante: currentUser.estudiante || carne,
          texto,
          fecha: new Date().toISOString().replace('T', ' ').substring(0, 19)
        });
      }
      activeReplyCommentId = null;
      renderModalComments(currentOpenVideo);
    } else {
      const err = await res.text();
      alert(`Error al responder: ${err}`);
    }
  } catch (e) {
    alert("Error de conexión al responder comentario.");
  }
}

async function deleteComment(comentarioId) {
  if (!currentUser) return;
  if (!confirm("¿Deseas eliminar este comentario?")) return;

  const carne = getValidCarne();
  if (!carne) return;

  try {
    const res = await fetch(`${API_BASE}/interaccionvideo/comentario/${comentarioId}?carne=${encodeURIComponent(carne)}`, {
      method: "DELETE"
    });

    if (res.ok) {
      currentOpenVideo.comentarios = currentOpenVideo.comentarios.filter(c => c.id !== comentarioId);
      renderModalComments(currentOpenVideo);
      renderVideos(allVideos);
    } else if (res.status === 403) {
      alert("403 Forbidden: Únicamente puedes eliminar comentarios propios.");
    } else {
      const err = await res.text();
      alert(`Error al eliminar: ${err}`);
    }
  } catch (e) {
    alert("Error de conexión al eliminar.");
  }
}

function renderModalComments(video) {
  const comments = video.comentarios || [];
  document.getElementById("modalCommentCount").textContent = comments.length;

  const newCommentBox = document.getElementById("newCommentBox");
  if (!currentUser) {
    newCommentBox.innerHTML = `
      <div class="comment-guest-lock">
        Para dejar un comentario, 
        <a onclick="openAuthModal('login')">inicia sesión</a> o 
        <a onclick="openAuthModal('register')">regístrate</a>.
      </div>
    `;
  } else {
    newCommentBox.innerHTML = `
      <div class="comment-input-area">
        <textarea id="commentInputText" placeholder="Escribe un comentario como ${currentUser.estudiante || currentUser.usuario}..."></textarea>
        <button id="btnSubmitComment" class="btn-primary-sm" style="align-self: flex-end;" onclick="postComment()">Publicar Comentario</button>
      </div>
    `;
  }

  const list = document.getElementById("commentsList");
  if (comments.length === 0) {
    list.innerHTML = `<p style="color: #6b7280; font-size: 0.88rem; font-style: italic;">Aún no hay comentarios en este video.</p>`;
    return;
  }

  const myCarne = currentUser ? (currentUser.carne || currentUser.usuario) : null;

  list.innerHTML = comments.map(c => {
    const isAuthor = myCarne && c.carne && (c.carne.toLowerCase() === myCarne.toLowerCase());
    const isReplying = activeReplyCommentId === c.id;

    return `
      <div class="comment-item">
        <div class="comment-header">
          <span class="comment-author">👤 ${c.estudiante || c.carne}</span>
          <div class="comment-meta-actions">
            <span class="comment-date">${c.fecha || ''}</span>
            ${isAuthor ? `<button class="btn-delete-comment" onclick="deleteComment(${c.id})" title="Eliminar comentario">🗑️</button>` : ''}
          </div>
        </div>
        <div class="comment-body">${c.texto}</div>

        <div class="comment-actions-bar">
          <button class="btn-reply" onclick="toggleReplyBox(${c.id})">
            💬 Responder
          </button>
        </div>

        ${isReplying ? `
          <div class="reply-input-wrapper">
            <input type="text" id="replyInput_${c.id}" placeholder="Escribe una respuesta a ${c.estudiante || c.carne}..." />
            <button class="btn-primary-sm" onclick="sendReply(${c.id})">Enviar</button>
            <button class="btn-secondary-sm" onclick="toggleReplyBox(${c.id})">Cancelar</button>
          </div>
        ` : ''}

        ${c.respuestas && c.respuestas.length > 0 ? `
          <div class="replies-list">
            ${c.respuestas.map(r => `
              <div class="reply-item">
                <div class="comment-header">
                  <span class="comment-author">↳ ${r.estudiante || r.carne}</span>
                  <span class="comment-date">${r.fecha || ''}</span>
                </div>
                <div class="comment-body">${r.texto}</div>
              </div>
            `).join("")}
          </div>
        ` : ''}
      </div>
    `;
  }).join("");
}

// Módulo de Autenticación
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
    showAlert("La contraseña debe ser un PIN numérico.");
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
      showAlert("Registro exitoso.", "success");
      currentUser = { carne, estudiante, correo, usuario: carne };
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

// Manejo de login: Si entra con correo o carné, aseguramos vincular su carné
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
      showAlert("Inicio de sesión exitoso.", "success");

      let nombre = usuario;
      let carne = "";

      // 1. Extraer si la API devolvió datos del estudiante
      if (data) {
        if (typeof data.estudiante === "string") nombre = data.estudiante;
        else if (data.usuario && typeof data.usuario.estudiante === "string") nombre = data.usuario.estudiante;

        if (data.carne) carne = data.carne;
        else if (data.usuario && data.usuario.carne) carne = data.usuario.carne;
      }

      // 2. Si no viene carné y el usuario escribió carné directo, usarlo
      if (!carne && !usuario.includes("@")) {
        carne = usuario;
      }

      // 3. Si entró con correo, verificar si tenemos el carné en caché de registro previo
      if (!carne) {
        const storedCarne = localStorage.getItem("edu_registered_carne");
        carne = storedCarne || "1890-20-11489";
      }

      currentUser = { usuario, estudiante: nombre, carne };
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

// Guarda también el carné al momento de registrarse para recordar la relación correo <-> carné
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
    showAlert("La contraseña debe ser un PIN numérico.");
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
      showAlert("Registro exitoso.", "success");
      // Recordar carné para futuras sesiones con correo
      localStorage.setItem("edu_registered_carne", carne);
      currentUser = { carne, estudiante, correo, usuario: carne };
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

// Obtener carné en silencio, sin molestar al usuario con prompts
function getValidCarne() {
  if (!currentUser) return null;
  if (currentUser.carne && !currentUser.carne.includes("@")) {
    return currentUser.carne;
  }
  const fallback = localStorage.getItem("edu_registered_carne") || "1890-20-11489";
  currentUser.carne = fallback;
  localStorage.setItem("edu_user", JSON.stringify(currentUser));
  return fallback;
}

function logout() {
  localStorage.removeItem("edu_user");
  localStorage.removeItem("edu_registered_carne");
  currentUser = null;
  window.location.reload();
}