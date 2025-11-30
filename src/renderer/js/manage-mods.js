const { ipcRenderer, shell } = require('electron');

// Éléments du DOM
const backBtn = document.getElementById('backBtn');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.getElementById('searchResults');
const searchStatus = document.getElementById('searchStatus');
const installedMods = document.getElementById('installedMods');
const modsCount = document.getElementById('modsCount');
const modpackNameEl = document.getElementById('modpackName');
const modpackDetailsEl = document.getElementById('modpackDetails');
const curseforgeFilter = document.getElementById('curseforgeFilter');
const modrinthFilter = document.getElementById('modrinthFilter');

let currentModpack = null;

// Charger les informations du modpack
async function loadModpackInfo() {
  if (!window.modpackId) {
    alert('Erreur: Aucun modpack sélectionné');
    window.location.href = 'index.html';
    return;
  }

  currentModpack = await ipcRenderer.invoke('get-modpack-by-id', window.modpackId);
  
  if (!currentModpack) {
    alert('Erreur: Modpack introuvable');
    window.location.href = 'index.html';
    return;
  }

  modpackNameEl.textContent = currentModpack.name;
  modpackDetailsEl.textContent = `Minecraft ${currentModpack.minecraftVersion} • ${currentModpack.loader.type}`;
  
  loadInstalledMods();
}

// Charger les mods installés
function loadInstalledMods() {
  const mods = currentModpack.mods || [];
  modsCount.textContent = mods.length;

  if (mods.length === 0) {
    installedMods.innerHTML = '<p class="no-mods">Aucun mod installé pour le moment</p>';
    return;
  }

  installedMods.innerHTML = '';

  mods.forEach(mod => {
    const card = createModCard(mod, true);
    installedMods.appendChild(card);
  });
}

// Rechercher des mods
searchBtn.addEventListener('click', async () => {
  const query = searchInput.value.trim();

  if (!query) {
    alert('Entre un nom de mod à rechercher');
    return;
  }

  searchBtn.disabled = true;
  searchBtn.textContent = '⏳ Recherche...';
  searchStatus.textContent = 'Recherche en cours...';
  searchStatus.style.background = 'rgba(0, 168, 255, 0.2)';
  searchResults.innerHTML = '<p class="no-results">Chargement...</p>';

  try {
    const searchParams = {
      query: query,
      minecraftVersion: currentModpack.minecraftVersion,
      curseforge: curseforgeFilter.checked,
      modrinth: modrinthFilter.checked
    };

    const results = await ipcRenderer.invoke('search-mods', searchParams);

    if (results.length === 0) {
      searchResults.innerHTML = '<p class="no-results">Aucun résultat trouvé</p>';
      searchStatus.textContent = 'Aucun résultat';
      searchStatus.style.background = 'rgba(255, 152, 0, 0.2)';
    } else {
      searchResults.innerHTML = '';
      results.forEach(mod => {
        const card = createModCard(mod, false);
        searchResults.appendChild(card);
      });
      searchStatus.textContent = `${results.length} mod(s) trouvé(s)`;
      searchStatus.style.background = 'rgba(76, 175, 80, 0.2)';
    }

  } catch (error) {
    console.error('Erreur recherche:', error);
    searchResults.innerHTML = '<p class="no-results">Erreur lors de la recherche</p>';
    searchStatus.textContent = 'Erreur: ' + error.message;
    searchStatus.style.background = 'rgba(244, 67, 54, 0.2)';
  }

  searchBtn.disabled = false;
  searchBtn.textContent = 'Rechercher';
});

// Recherche avec Enter
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    searchBtn.click();
  }
});

// Créer une carte de mod
function createModCard(mod, isInstalled) {
  const card = document.createElement('div');
  card.className = 'mod-card';

  const iconHtml = mod.icon
    ? `<img src="${mod.icon}" class="mod-icon" alt="${mod.name}">`
    : `<div class="mod-icon-placeholder">📦</div>`;

  const sourceClass = mod.source === 'curseforge' ? 'curseforge' : 'modrinth';
  const sourceLabel = mod.source === 'curseforge' ? 'CurseForge' : 'Modrinth';

  const downloads = mod.downloads ? `📥 ${formatNumber(mod.downloads)}` : '';

  card.innerHTML = `
    <span class="mod-source ${sourceClass}">${sourceLabel}</span>
    <div class="mod-header">
      ${iconHtml}
      <div class="mod-info">
        <h4>${mod.name}</h4>
        <p class="mod-author">Par ${mod.author}</p>
      </div>
    </div>
    <p class="mod-summary">${mod.summary}</p>
    <div class="mod-stats">
      ${downloads}
    </div>
    <div class="mod-actions">
      ${isInstalled
        ? `<button class="btn-uninstall" data-mod='${JSON.stringify(mod)}'>Désinstaller</button>`
        : `<button class="btn-install" data-mod='${JSON.stringify(mod)}'>Installer</button>`
      }
      <button class="btn-view" data-url="${mod.websiteUrl}">Voir</button>
    </div>
  `;

  // Événements
  const installBtn = card.querySelector('.btn-install');
  const uninstallBtn = card.querySelector('.btn-uninstall');
  const viewBtn = card.querySelector('.btn-view');

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      await installMod(mod, installBtn);
    });
  }

  if (uninstallBtn) {
    uninstallBtn.addEventListener('click', async () => {
      await uninstallMod(mod);
    });
  }

  viewBtn.addEventListener('click', () => {
    shell.openExternal(mod.websiteUrl);
  });

  return card;
}

// Installer un mod
async function installMod(mod, button) {
  button.disabled = true;
  button.textContent = '⏳ Installation...';

  try {
    const result = await ipcRenderer.invoke('install-mod', {
      modpackId: window.modpackId,
      mod: mod
    });

    if (result.success) {
      button.textContent = '✅ Installé';
      setTimeout(() => {
        currentModpack.mods = result.modpack.mods;
        loadInstalledMods();
      }, 1000);
    } else {
      button.textContent = '❌ Erreur';
      button.disabled = false;
    }

  } catch (error) {
    console.error('Erreur installation:', error);
    alert('Erreur: ' + error.message);
    button.textContent = 'Installer';
    button.disabled = false;
  }
}

// Désinstaller un mod
async function uninstallMod(mod) {
  if (!confirm(`Désinstaller ${mod.name} ?`)) {
    return;
  }

  try {
    const result = await ipcRenderer.invoke('uninstall-mod', {
      modpackId: window.modpackId,
      modId: mod.id
    });

    if (result.success) {
      currentModpack.mods = result.modpack.mods;
      loadInstalledMods();
    }

  } catch (error) {
    console.error('Erreur désinstallation:', error);
    alert('Erreur: ' + error.message);
  }
}

// Formater les nombres
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// Bouton retour
backBtn.addEventListener('click', () => {
  window.location.href = 'index.html';
});

// Charger au démarrage
loadModpackInfo();