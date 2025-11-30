const axios = require('axios');
const fs = require('fs');
const path = require('path');

class APIManager {
  constructor() {
    // ⚠️ REMPLACE 'TA_CLE_API_ICI' par ta vraie clé CurseForge
    this.curseforgeApiKey = '$2a$10$pTLqH/to1l0./uaJqEnR9eAfOoeVavJYr/bzYUu0dgJNeAflhqPii';
    
    this.curseforgeBaseUrl = 'https://api.curseforge.com/v1';
    this.modrinthBaseUrl = 'https://api.modrinth.com/v2';
  }

  // ========== CURSEFORGE ==========

  // Rechercher des mods sur CurseForge
  async searchCurseforgeMods(query, minecraftVersion = null) {
    try {
      const params = {
        gameId: 432, // ID de Minecraft
        classId: 6, // ID de la catégorie "Mods"
        searchFilter: query,
        pageSize: 20
      };

      if (minecraftVersion) {
        params.gameVersion = minecraftVersion;
      }

      const response = await axios.get(`${this.curseforgeBaseUrl}/mods/search`, {
        headers: {
          'x-api-key': this.curseforgeApiKey,
          'Accept': 'application/json'
        },
        params: params
      });

      return response.data.data.map(mod => ({
        id: mod.id,
        name: mod.name,
        summary: mod.summary,
        author: mod.authors[0]?.name || 'Inconnu',
        downloads: mod.downloadCount,
        icon: mod.logo?.url || null,
        websiteUrl: mod.links.websiteUrl,
        source: 'curseforge',
        categories: mod.categories.map(cat => cat.name)
      }));

    } catch (error) {
      console.error('Erreur recherche CurseForge:', error.message);
      if (error.response?.status === 403) {
        throw new Error('Clé API CurseForge invalide. Vérifie ta configuration.');
      }
      return [];
    }
  }

  // Obtenir les fichiers d'un mod CurseForge
  async getCurseforgeModFiles(modId, minecraftVersion = null) {
    try {
      const params = {
        pageSize: 10
      };

      if (minecraftVersion) {
        params.gameVersion = minecraftVersion;
      }

      const response = await axios.get(`${this.curseforgeBaseUrl}/mods/${modId}/files`, {
        headers: {
          'x-api-key': this.curseforgeApiKey,
          'Accept': 'application/json'
        },
        params: params
      });

      return response.data.data.map(file => ({
        id: file.id,
        displayName: file.displayName,
        fileName: file.fileName,
        downloadUrl: file.downloadUrl,
        fileDate: file.fileDate,
        fileLength: file.fileLength,
        gameVersions: file.gameVersions
      }));

    } catch (error) {
      console.error('Erreur récupération fichiers CurseForge:', error.message);
      return [];
    }
  }

  // Télécharger un fichier depuis CurseForge
  async downloadCurseforgeFile(downloadUrl, fileName, destinationPath) {
    try {
      const response = await axios({
        url: downloadUrl,
        method: 'GET',
        responseType: 'stream'
      });

      const filePath = path.join(destinationPath, fileName);
      const writer = fs.createWriteStream(filePath);

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(filePath));
        writer.on('error', reject);
      });

    } catch (error) {
      console.error('Erreur téléchargement:', error.message);
      throw error;
    }
  }

  // ========== MODRINTH ==========

  // Rechercher des mods sur Modrinth
  async searchModrinthMods(query, minecraftVersion = null) {
    try {
      const params = {
        query: query,
        limit: 20,
        facets: '[["project_type:mod"]]'
      };

      if (minecraftVersion) {
        params.facets = `[["project_type:mod"],["versions:${minecraftVersion}"]]`;
      }

      const response = await axios.get(`${this.modrinthBaseUrl}/search`, {
        params: params
      });

      return response.data.hits.map(mod => ({
        id: mod.project_id,
        slug: mod.slug,
        name: mod.title,
        summary: mod.description,
        author: mod.author,
        downloads: mod.downloads,
        icon: mod.icon_url,
        websiteUrl: `https://modrinth.com/mod/${mod.slug}`,
        source: 'modrinth',
        categories: mod.categories
      }));

    } catch (error) {
      console.error('Erreur recherche Modrinth:', error.message);
      return [];
    }
  }

  // Obtenir les versions d'un mod Modrinth
  async getModrinthModVersions(projectId, minecraftVersion = null) {
    try {
      let url = `${this.modrinthBaseUrl}/project/${projectId}/version`;

      if (minecraftVersion) {
        url += `?game_versions=["${minecraftVersion}"]`;
      }

      const response = await axios.get(url);

      return response.data.map(version => ({
        id: version.id,
        name: version.name,
        versionNumber: version.version_number,
        gameVersions: version.game_versions,
        loaders: version.loaders,
        files: version.files.map(file => ({
          url: file.url,
          filename: file.filename,
          size: file.size
        })),
        datePublished: version.date_published
      }));

    } catch (error) {
      console.error('Erreur récupération versions Modrinth:', error.message);
      return [];
    }
  }

  // Télécharger un fichier depuis Modrinth
  async downloadModrinthFile(downloadUrl, fileName, destinationPath) {
    try {
      const response = await axios({
        url: downloadUrl,
        method: 'GET',
        responseType: 'stream'
      });

      const filePath = path.join(destinationPath, fileName);
      const writer = fs.createWriteStream(filePath);

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(filePath));
        writer.on('error', reject);
      });

    } catch (error) {
      console.error('Erreur téléchargement:', error.message);
      throw error;
    }
  }

  // ========== RECHERCHE COMBINÉE ==========

  // Rechercher sur les deux plateformes en même temps
  async searchAllMods(query, minecraftVersion = null) {
    try {
      const [curseforgeResults, modrinthResults] = await Promise.all([
        this.searchCurseforgeMods(query, minecraftVersion),
        this.searchModrinthMods(query, minecraftVersion)
      ]);

      // Combiner et trier par nombre de téléchargements
      const allResults = [...curseforgeResults, ...modrinthResults];
      allResults.sort((a, b) => b.downloads - a.downloads);

      return allResults;

    } catch (error) {
      console.error('Erreur recherche combinée:', error.message);
      return [];
    }
  }
}

module.exports = APIManager;