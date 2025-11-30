const { ipcRenderer } = require('electron');

// Éléments du DOM
const loginSection = document.getElementById('loginSection');
const modpackSection = document.getElementById('modpackSection');
const loginBtn = document.getElementById('loginBtn');
const loginStatus = document.getElementById('loginStatus');
const usernameDisplay = document.getElementById('username');
const logoutBtn = document.getElementById('logoutBtn');
const modpackList = document.getElementById('modpackList');
const createModpackBtn = document.getElementById('createModpack');

// Charger les modpacks
async function loadModpacks() {
  const modpacks = await ipcRenderer.invoke('get-modpacks');
  
  if (modpacks.length === 0) {
    modpackList.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
        <p style="font-size: 20px; opacity: 0.7;">Aucun modpack créé</p>
        <p style="font-size: 14px; opacity: 0.5;">Clique sur "Créer un Modpack" pour commencer</p>
      </div>
    `;
    return;
  }
  
  modpackList.innerHTML = '';
  
  modpacks.forEach(modpack => {
    const card = document.createElement('div');
    card.className = 'modpack-card';
    card.innerHTML = `
      <div class="modpack-icon">${modpack.icon}</div>
      <h3>${modpack.name}</h3>
      <p>Minecraft ${modpack.minecraftVersion} • ${modpack.loader.type}</p>
      <p style="font-size: 12px; opacity: 0.7; margin: 5px 0;">
        ${modpack.mods?.length || 0} mod(s) installé(s)
      </p>
      <button class="btn-play" data-id="${modpack.id}">Jouer</button>
      <button class="btn-manage" data-id="${modpack.id}">📦 Mods</button>
      <button class="btn-delete" data-id="${modpack.id}">🗑️</button>
    `;
    modpackList.appendChild(card);
  });
  
  // Événements boutons "Jouer"
  document.querySelectorAll('.btn-play').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      alert('Lancement du modpack (en développement)');
    });
  });

  // Événements boutons "Gérer les mods"
  document.querySelectorAll('.btn-manage').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      window.location.href = `manage-mods.html?id=${id}`;
    });
  });
  
  // Événements boutons "Supprimer"
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      if (confirm('Êtes-vous sûr de vouloir supprimer ce modpack ?')) {
        const result = await ipcRenderer.invoke('delete-modpack', id);
        if (result.success) {
          loadModpacks();
        }
      }
    });
  });
}

// Bouton de connexion
loginBtn.addEventListener('click', async () => {
  loginBtn.disabled = true;
  loginBtn.textContent = '⏳ Connexion...';
  loginStatus.textContent = 'Authentification en cours...';
  loginStatus.style.background = 'rgba(0, 168, 255, 0.2)';
  
  try {
    const user = await ipcRenderer.invoke('authenticate');
    
    loginStatus.textContent = '✅ Connecté avec succès !';
    loginStatus.style.background = 'rgba(76, 175, 80, 0.3)';
    
    localStorage.setItem('user', JSON.stringify(user));
    
    setTimeout(() => {
      loginSection.style.display = 'none';
      modpackSection.style.display = 'block';
      usernameDisplay.textContent = user.username;
      loadModpacks();
    }, 1000);
    
  } catch (error) {
    console.error('Erreur:', error);
    loginStatus.textContent = '❌ Erreur : ' + error.message;
    loginStatus.style.background = 'rgba(244, 67, 54, 0.3)';
    loginBtn.disabled = false;
    loginBtn.textContent = 'Se connecter';
  }
});

// Bouton de déconnexion
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('user');
  modpackSection.style.display = 'none';
  loginSection.style.display = 'flex';
  loginBtn.disabled = false;
  loginBtn.textContent = 'Se connecter';
  loginStatus.textContent = '';
});

// Vérifier si déjà connecté
const savedUser = localStorage.getItem('user');
if (savedUser) {
  const user = JSON.parse(savedUser);
  loginSection.style.display = 'none';
  modpackSection.style.display = 'block';
  usernameDisplay.textContent = user.username;
  loadModpacks();
}

// Bouton créer modpack
createModpackBtn.addEventListener('click', () => {
  window.location.href = 'create-modpack.html';
});