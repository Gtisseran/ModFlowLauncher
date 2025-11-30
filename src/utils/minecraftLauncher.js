const { Client, Authenticator } = require('minecraft-launcher-core');
const path = require('path');
const fs = require('fs');
const https = require('https');
const AdmZip = require('adm-zip');

class MinecraftLauncher {
  constructor(modpackManager) {
    this.modpackManager = modpackManager;
    this.minecraftPath = path.join(process.cwd(), 'minecraft');
    
    // Créer le dossier Minecraft s'il n'existe pas
    if (!fs.existsSync(this.minecraftPath)) {
      fs.mkdirSync(this.minecraftPath, { recursive: true });
    }
  }

  // Lancer Minecraft avec un modpack
  async launch(modpackId, credentials) {
    try {
      const modpack = this.modpackManager.getModpackById(modpackId);
      
      if (!modpack) {
        throw new Error('Modpack introuvable');
      }

      console.log('🚀 Préparation du lancement...');
      console.log(`📦 Modpack: ${modpack.name}`);
      console.log(`🎮 Version: ${modpack.minecraftVersion}`);
      console.log(`⚙️ Loader: ${modpack.loader.type}`);

      // Préparer le dossier du modpack
      const modpackPath = path.join(this.modpackManager.modpacksPath, modpackId);
      const gameDirectory = path.join(this.minecraftPath, 'instances', modpackId);

      if (!fs.existsSync(gameDirectory)) {
        fs.mkdirSync(gameDirectory, { recursive: true });
      }

      // Copier les mods dans le dossier de l'instance
      await this.prepareMods(modpackPath, gameDirectory);

      // Télécharger le loader si nécessaire
      if (modpack.loader.type === 'fabric') {
        await this.installFabric(modpack.minecraftVersion, modpack.loader.version, gameDirectory);
      } else if (modpack.loader.type === 'forge') {
        await this.installForge(modpack.minecraftVersion, modpack.loader.version, gameDirectory);
      }

      // Configurer le launcher
      const launcher = new Client();

      // Options de lancement
      const opts = {
        authorization: this.getAuth(credentials),
        root: this.minecraftPath,
        version: {
          number: modpack.minecraftVersion,
          type: 'release',
          custom: modpack.loader.type !== 'vanilla' ? `${modpack.loader.type}-${modpack.minecraftVersion}` : undefined
        },
        memory: {
          max: modpack.settings.ram || 4096,
          min: 2048
        },
        overrides: {
          gameDirectory: gameDirectory,
          minecraftJar: null
        }
      };

      // Ajouter les arguments Java personnalisés
      if (modpack.settings.javaArgs) {
        opts.javaPath = modpack.settings.javaArgs;
      }

      console.log('📥 Téléchargement des fichiers Minecraft...');

      // Événements de progression
      launcher.on('debug', (e) => console.log('🔍', e));
      launcher.on('data', (e) => console.log('📋', e));
      launcher.on('progress', (e) => {
        console.log(`⏳ Progression: ${e.type} ${e.task}/${e.total}`);
      });
      launcher.on('close', (code) => {
        console.log(`🛑 Minecraft fermé avec le code: ${code}`);
      });

      // Lancer Minecraft
      console.log('🎮 Lancement de Minecraft...');
      launcher.launch(opts);

      // Mettre à jour la date de dernière utilisation
      this.modpackManager.updateLastPlayed(modpackId);

      return { success: true };

    } catch (error) {
      console.error('❌ Erreur de lancement:', error);
      throw error;
    }
  }

  // Préparer les mods
  async prepareMods(modpackPath, gameDirectory) {
    const modsSource = path.join(modpackPath, 'mods');
    const modsDestination = path.join(gameDirectory, 'mods');

    if (!fs.existsSync(modsDestination)) {
      fs.mkdirSync(modsDestination, { recursive: true });
    }

    // Copier tous les mods
    if (fs.existsSync(modsSource)) {
      const mods = fs.readdirSync(modsSource);
      
      for (const mod of mods) {
        const sourcePath = path.join(modsSource, mod);
        const destPath = path.join(modsDestination, mod);
        
        // Copier le fichier s'il n'existe pas déjà
        if (!fs.existsSync(destPath)) {
          fs.copyFileSync(sourcePath, destPath);
          console.log(`📦 Copié: ${mod}`);
        }
      }

      console.log(`✅ ${mods.length} mod(s) prêt(s)`);
    }
  }

  // Installer Fabric
  async installFabric(minecraftVersion, fabricVersion, gameDirectory) {
    console.log('🧵 Installation de Fabric...');

    // Télécharger le loader Fabric
    const fabricUrl = `https://meta.fabricmc.net/v2/versions/loader/${minecraftVersion}/${fabricVersion || 'latest'}/profile/json`;
    
    try {
      const profilePath = path.join(gameDirectory, 'fabric-profile.json');
      
      await this.downloadFile(fabricUrl, profilePath);
      console.log('✅ Fabric installé');
      
    } catch (error) {
      console.warn('⚠️ Impossible d\'installer Fabric automatiquement');
      console.log('Lancement en mode vanilla...');
    }
  }

  // Installer Forge (simplifié)
  async installForge(minecraftVersion, forgeVersion, gameDirectory) {
    console.log('🔨 Forge nécessite une installation manuelle pour le moment');
    console.log('Lancement en mode vanilla...');
  }

  // Télécharger un fichier
  downloadFile(url, destination) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destination);
      
      https.get(url, (response) => {
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(destination, () => {});
        reject(err);
      });
    });
  }

  // Obtenir l'authentification
  getAuth(credentials) {
    // Mode développement : utiliser l'auth offline
    return Authenticator.getAuth(credentials.username);
  }
}

module.exports = MinecraftLauncher;