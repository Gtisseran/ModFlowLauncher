const fs = require('fs');
const path = require('path');

class ModpackManager {
  constructor() {
    // Dossier où seront stockés les modpacks
    this.modpacksPath = path.join(process.cwd(), 'modpacks');
    this.configPath = path.join(this.modpacksPath, 'config.json');
    
    // Créer le dossier s'il n'existe pas
    this.initializeStorage();
  }

  // Initialiser le stockage
  initializeStorage() {
    if (!fs.existsSync(this.modpacksPath)) {
      fs.mkdirSync(this.modpacksPath, { recursive: true });
    }
    
    if (!fs.existsSync(this.configPath)) {
      this.saveConfig({ modpacks: [] });
    }
  }

  // Lire la configuration
  getConfig() {
    try {
      const data = fs.readFileSync(this.configPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Erreur lecture config:', error);
      return { modpacks: [] };
    }
  }

  // Sauvegarder la configuration
  saveConfig(config) {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error('Erreur sauvegarde config:', error);
      return false;
    }
  }

  // Créer un nouveau modpack
  createModpack(modpackData) {
    const config = this.getConfig();
    
    // Générer un ID unique
    const id = 'modpack_' + Date.now();
    
    // Créer le modpack avec toutes les infos
    const newModpack = {
      id: id,
      name: modpackData.name,
      icon: modpackData.icon || '📦',
      minecraftVersion: modpackData.minecraftVersion,
      loader: {
        type: modpackData.loaderType, // fabric, forge, neoforge, quilt
        version: modpackData.loaderVersion
      },
      mods: [],
      datapacks: [],
      resourcepacks: [],
      shaders: [],
      worlds: [],
      settings: {
        ram: modpackData.ram || 4096,
        javaArgs: modpackData.javaArgs || ''
      },
      createdAt: new Date().toISOString(),
      lastPlayed: null
    };
    
    // Créer le dossier du modpack
    const modpackFolder = path.join(this.modpacksPath, id);
    fs.mkdirSync(modpackFolder, { recursive: true });
    
    // Créer les sous-dossiers
    ['mods', 'datapacks', 'resourcepacks', 'shaderpacks', 'saves'].forEach(folder => {
      fs.mkdirSync(path.join(modpackFolder, folder), { recursive: true });
    });
    
    // Ajouter à la config
    config.modpacks.push(newModpack);
    this.saveConfig(config);
    
    console.log('✅ Modpack créé:', newModpack.name);
    return newModpack;
  }

  // Récupérer tous les modpacks
  getAllModpacks() {
    const config = this.getConfig();
    return config.modpacks;
  }

  // Récupérer un modpack par ID
  getModpackById(id) {
    const config = this.getConfig();
    return config.modpacks.find(mp => mp.id === id);
  }

  // Mettre à jour un modpack
  updateModpack(id, updates) {
    const config = this.getConfig();
    const index = config.modpacks.findIndex(mp => mp.id === id);
    
    if (index !== -1) {
      config.modpacks[index] = { ...config.modpacks[index], ...updates };
      this.saveConfig(config);
      console.log('✅ Modpack mis à jour:', id);
      return config.modpacks[index];
    }
    
    return null;
  }

  // Supprimer un modpack
  deleteModpack(id) {
    const config = this.getConfig();
    const index = config.modpacks.findIndex(mp => mp.id === id);
    
    if (index !== -1) {
      const modpack = config.modpacks[index];
      
      // Supprimer le dossier
      const modpackFolder = path.join(this.modpacksPath, id);
      if (fs.existsSync(modpackFolder)) {
        fs.rmSync(modpackFolder, { recursive: true, force: true });
      }
      
      // Retirer de la config
      config.modpacks.splice(index, 1);
      this.saveConfig(config);
      
      console.log('✅ Modpack supprimé:', modpack.name);
      return true;
    }
    
    return false;
  }

  // Mettre à jour la date de dernière utilisation
  updateLastPlayed(id) {
    const config = this.getConfig();
    const index = config.modpacks.findIndex(mp => mp.id === id);
    
    if (index !== -1) {
      config.modpacks[index].lastPlayed = new Date().toISOString();
      this.saveConfig(config);
    }
  }
}

module.exports = ModpackManager;