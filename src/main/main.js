const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const MinecraftAuth = require('./auth');
const ModpackManager = require('../utils/modpackManager');
const APIManager = require('../utils/apiManager');
const MinecraftLauncher = require('../utils/minecraftLauncher');

let mainWindow;
const modpackManager = new ModpackManager();
const apiManager = new APIManager();
const minecraftLauncher = new MinecraftLauncher(modpackManager);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  // mainWindow.webContents.openDevTools();  // ← Doit être commentée avec //
}

// ========== AUTHENTIFICATION ==========
ipcMain.handle('authenticate', async () => {
  try {
    const auth = new MinecraftAuth();
    const user = await auth.authenticate();
    return user;
  } catch (error) {
    console.error('Erreur auth:', error);
    throw error;
  }
});

// ========== MODPACKS ==========

// Créer un modpack
ipcMain.handle('create-modpack', async (event, modpackData) => {
  try {
    const modpack = modpackManager.createModpack(modpackData);
    return { success: true, modpack };
  } catch (error) {
    console.error('Erreur création modpack:', error);
    return { success: false, error: error.message };
  }
});

// Récupérer tous les modpacks
ipcMain.handle('get-modpacks', async () => {
  try {
    const modpacks = modpackManager.getAllModpacks();
    return modpacks;
  } catch (error) {
    console.error('Erreur récupération modpacks:', error);
    return [];
  }
});

// Récupérer un modpack par ID
ipcMain.handle('get-modpack-by-id', async (event, id) => {
  try {
    const modpack = modpackManager.getModpackById(id);
    return modpack;
  } catch (error) {
    console.error('Erreur récupération modpack:', error);
    return null;
  }
});

// Supprimer un modpack
ipcMain.handle('delete-modpack', async (event, id) => {
  try {
    const success = modpackManager.deleteModpack(id);
    return { success };
  } catch (error) {
    console.error('Erreur suppression modpack:', error);
    return { success: false, error: error.message };
  }
});

// ========== RECHERCHE DE MODS ==========

// Rechercher des mods
ipcMain.handle('search-mods', async (event, searchParams) => {
  try {
    const { query, minecraftVersion, curseforge, modrinth } = searchParams;
    let results = [];

    if (curseforge && modrinth) {
      // Recherche sur les deux plateformes
      results = await apiManager.searchAllMods(query, minecraftVersion);
    } else if (curseforge) {
      // Seulement CurseForge
      results = await apiManager.searchCurseforgeMods(query, minecraftVersion);
    } else if (modrinth) {
      // Seulement Modrinth
      results = await apiManager.searchModrinthMods(query, minecraftVersion);
    }

    return results;
  } catch (error) {
    console.error('Erreur recherche mods:', error);
    throw error;
  }
});

// ========== INSTALLATION DE MODS ==========

// Installer un mod
ipcMain.handle('install-mod', async (event, data) => {
  try {
    const { modpackId, mod } = data;
    const modpack = modpackManager.getModpackById(modpackId);

    if (!modpack) {
      throw new Error('Modpack introuvable');
    }

    // Vérifier si le mod n'est pas déjà installé
    const alreadyInstalled = modpack.mods.find(m => m.id === mod.id && m.source === mod.source);
    if (alreadyInstalled) {
      throw new Error('Ce mod est déjà installé');
    }

    // Obtenir le fichier à télécharger
    let fileToDownload = null;

    if (mod.source === 'curseforge') {
      const files = await apiManager.getCurseforgeModFiles(mod.id, modpack.minecraftVersion);
      if (files.length === 0) {
        throw new Error('Aucun fichier disponible pour cette version de Minecraft');
      }
      fileToDownload = files[0]; // Prendre le fichier le plus récent
    } else if (mod.source === 'modrinth') {
      const versions = await apiManager.getModrinthModVersions(mod.id, modpack.minecraftVersion);
      if (versions.length === 0) {
        throw new Error('Aucune version disponible pour cette version de Minecraft');
      }
      fileToDownload = versions[0].files[0]; // Prendre le premier fichier de la version la plus récente
    }

    if (!fileToDownload) {
      throw new Error('Impossible de trouver un fichier à télécharger');
    }

    // Chemin de destination
    const destinationPath = path.join(modpackManager.modpacksPath, modpackId, 'mods');

    // Télécharger le fichier
    let downloadedPath;
    if (mod.source === 'curseforge') {
      downloadedPath = await apiManager.downloadCurseforgeFile(
        fileToDownload.downloadUrl,
        fileToDownload.fileName,
        destinationPath
      );
    } else if (mod.source === 'modrinth') {
      downloadedPath = await apiManager.downloadModrinthFile(
        fileToDownload.url,
        fileToDownload.filename,
        destinationPath
      );
    }

    console.log('✅ Mod téléchargé:', downloadedPath);

    // Ajouter le mod à la liste des mods installés
    const installedMod = {
      id: mod.id,
      name: mod.name,
      author: mod.author,
      source: mod.source,
      fileName: mod.source === 'curseforge' ? fileToDownload.fileName : fileToDownload.filename,
      downloadUrl: mod.websiteUrl,
      installedAt: new Date().toISOString()
    };

    modpack.mods.push(installedMod);
    const updatedModpack = modpackManager.updateModpack(modpackId, { mods: modpack.mods });

    return { success: true, modpack: updatedModpack };

  } catch (error) {
    console.error('Erreur installation mod:', error);
    throw error;
  }
});

// Désinstaller un mod
ipcMain.handle('uninstall-mod', async (event, data) => {
  try {
    const { modpackId, modId } = data;
    const modpack = modpackManager.getModpackById(modpackId);

    if (!modpack) {
      throw new Error('Modpack introuvable');
    }

    // Trouver le mod
    const modIndex = modpack.mods.findIndex(m => m.id === modId);
    if (modIndex === -1) {
      throw new Error('Mod introuvable');
    }

    const mod = modpack.mods[modIndex];

    // Supprimer le fichier
    const fs = require('fs');
    const filePath = path.join(modpackManager.modpacksPath, modpackId, 'mods', mod.fileName);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('✅ Fichier supprimé:', filePath);
    }

    // Retirer de la liste
    modpack.mods.splice(modIndex, 1);
    const updatedModpack = modpackManager.updateModpack(modpackId, { mods: modpack.mods });

    return { success: true, modpack: updatedModpack };

  } catch (error) {
    console.error('Erreur désinstallation mod:', error);
    throw error;
  }
});

// ========== LANCEMENT DE MINECRAFT ==========

// Lancer Minecraft
ipcMain.handle('launch-minecraft', async (event, modpackId) => {
  try {
    // Récupérer les credentials de l'utilisateur
    const credentials = {
      username: 'DevPlayer', // En mode dev
      uuid: '00000000-0000-0000-0000-000000000000'
    };

    const result = await minecraftLauncher.launch(modpackId, credentials);
    return result;
    
  } catch (error) {
    console.error('Erreur lancement:', error);
    throw error;
  }
});

// ========== ELECTRON ==========

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});