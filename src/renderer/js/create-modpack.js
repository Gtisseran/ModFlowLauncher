const { ipcRenderer } = require('electron');

// Éléments du DOM
const form = document.getElementById('createModpackForm');
const backBtn = document.getElementById('backBtn');
const cancelBtn = document.getElementById('cancelBtn');
const ramSlider = document.getElementById('ramAllocation');
const ramValue = document.getElementById('ramValue');
const ramGB = document.getElementById('ramGB');
const iconInput = document.getElementById('modpackIcon');

// Gestion du slider RAM
ramSlider.addEventListener('input', (e) => {
  const value = parseInt(e.target.value);
  ramValue.textContent = value;
  ramGB.textContent = (value / 1024).toFixed(1);
});

// Sélection d'icône
document.querySelectorAll('.icon-option').forEach(icon => {
  icon.addEventListener('click', (e) => {
    iconInput.value = e.target.dataset.icon;
  });
});

// Bouton retour
backBtn.addEventListener('click', () => {
  window.location.href = 'index.html';
});

// Bouton annuler
cancelBtn.addEventListener('click', () => {
  window.location.href = 'index.html';
});

// Soumission du formulaire
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Récupérer les valeurs
  const modpackData = {
    name: document.getElementById('modpackName').value,
    icon: document.getElementById('modpackIcon').value,
    minecraftVersion: document.getElementById('minecraftVersion').value,
    loaderType: document.getElementById('loaderType').value,
    loaderVersion: document.getElementById('loaderVersion').value || 'latest',
    ram: parseInt(ramSlider.value),
    javaArgs: document.getElementById('javaArgs').value
  };
  
  // Validation
  if (!modpackData.name || !modpackData.minecraftVersion || !modpackData.loaderType) {
    alert('❌ Veuillez remplir tous les champs obligatoires');
    return;
  }
  
  try {
    // Envoyer au processus principal
    const result = await ipcRenderer.invoke('create-modpack', modpackData);
    
    if (result.success) {
      alert('✅ Modpack créé avec succès !');
      window.location.href = 'index.html';
    } else {
      alert('❌ Erreur lors de la création du modpack');
    }
  } catch (error) {
    console.error('Erreur:', error);
    alert('❌ Erreur : ' + error.message);
  }
});