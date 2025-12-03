# 🚄 SNCF Analytics - Observatoire Sémantique des Gares

> Application web de visualisation de données basée sur le Web Sémantique pour explorer la fréquentation des gares françaises (2015-2023)

---

## 📋 Table des matières

- [Vue d'ensemble](#-vue-densemble)
- [Fonctionnalités](#-fonctionnalités)
- [Technologies utilisées](#-technologies-utilisées)
- [Améliorations récentes](#-améliorations-récentes)
- [Installation](#-installation)
- [Résolution des problèmes](#-résolution-des-problèmes-cors)
- [Pipeline de données](#-pipeline-de-données)
- [Structure du projet](#-structure-du-projet)

---

## 🎯 Vue d'ensemble

Cette application permet d'explorer la fréquentation de **~3000 gares françaises** entre 2015 et 2023, enrichie géographiquement via **Wikidata**. 

### Architecture hybride

L'application propose deux modes de fonctionnement :

- **📂 Mode JSON** : Autonome et portable (fonctionne sur GitHub Pages)
- **⚡ Mode SPARQL Live** : Connexion temps réel à GraphDB

---

## ✨ Fonctionnalités

### 🗺️ Carte Interactive
Visualisation géographique des gares avec regroupement automatique (clustering) via Leaflet

### 📊 Tableau de Bord Dynamique
- **Statistiques globales** en temps réel
  - Nombre total de gares affichées
  - Mise à jour dynamique selon les filtres appliqués
- **Répartition géographique** par région (graphique circulaire interactif)
- **🏆 Top Trafic** 
  - Filtrage par année (toutes les années disponibles : 2015-2023)
  - Choix du nombre de gares à afficher (1 à 10)
  - Tri par ordre décroissant (plus fort trafic en premier)
- **📉 Top des Pires Trafics**
  - Filtrage par année (toutes les années disponibles : 2015-2023)
  - Choix du nombre de gares à afficher (1 à 10)
  - Tri par ordre croissant (plus faible trafic en premier)
  - Exclusion des gares sans trafic

### 📈 Détails par Gare
- Graphique d'évolution temporelle du trafic (2015-2023) accessible en un clic
- Photo de la gare récupérée automatiquement depuis Wikidata
- Informations géographiques (département, région)

### 🔍 Filtres et Recherche
- **Barre de recherche** avec filtrage en temps réel
- **Filtre par région** avec liste déroulante dynamique
- Zoom automatique sur la gare sélectionnée
- Mise à jour automatique de tous les graphiques

### 🎨 Interface Moderne
- **Mode sombre/clair** avec basculement instantané
- Design responsive et moderne
- Animations fluides et micro-interactions
- Thème persistant (sauvegardé dans le navigateur)

### 🔄 Basculement de Source de Données
Bouton de switch pour alterner entre mode JSON et SPARQL Live sans recharger la page

---

## 🛠️ Technologies utilisées

### Backend Sémantique
- **Format de données** : RDF (Turtle), SPARQL
- **Base de données** : GraphDB (Ontotext)
- **Enrichissement** : Requêtes fédérées vers Wikidata

### Frontend
- **Langages** : HTML5, CSS3, JavaScript (ES6+)
- **Librairies** :
  - `Leaflet.js` - Cartographie interactive
  - `Chart.js` - Visualisations graphiques
  - `Leaflet.markercluster` - Gestion optimisée des marqueurs

---

## 🆕 Améliorations Récentes

### Version 2.0 - Décembre 2024

#### 🎨 Interface Modernisée
- **Mode Sombre/Clair** : Basculement instantané avec persistance du choix
- **Design Premium** : Palette de couleurs harmonieuse, animations fluides
- **Responsive** : Interface adaptée à tous les écrans

#### 🔍 Filtres Avancés
- **Filtre par Région** : Sélection dynamique parmi toutes les régions
- **Recherche en Temps Réel** : Filtrage instantané des gares
- **Mise à Jour Automatique** : Tous les graphiques se synchronisent

#### 📊 Analyses Enrichies
- **Top Trafic Configurable**
  - Sélection de l'année (2015-2023)
  - Choix du nombre de gares (1-10)
  - Tri dynamique par trafic décroissant
  
- **Top des Pires Trafics**
  - Même système de filtres que le Top Trafic
  - Identification des gares à faible fréquentation
  - Exclusion automatique des gares sans données

#### 🖼️ Enrichissement Visuel
- **Photos des Gares** : Récupération automatique depuis Wikidata
- **Graphiques Thématiques** : Adaptation automatique au thème choisi
- **Interactions Améliorées** : Survol, clics, animations

---

## ⚙️ Installation

### 🚀 Option 1 : Lancement Rapide (Mode Statique)

**Recommandé pour tester le projet sans installation de base de données**

1. Téléchargez ce dépôt
2. Vérifiez la présence du fichier `gares.json` dans le même dossier que `index.html`

3. **Lancez un serveur local** (requis pour éviter les erreurs CORS) :

   **Méthode A - VS Code**
   ```
   Clic-droit sur index.html → "Open with Live Server"
   ```

   **Méthode B - Python**
   ```bash
   python -m http.server
   ```

   **Méthode C - GitHub Pages**
   ```
   Accédez directement au projet en ligne via GitHub Pages
   ```

> ⚠️ **Important** : Ne pas ouvrir `index.html` directement en double-cliquant (problème de sécurité CORS)

---

### ⚡ Option 2 : Lancement Complet (Mode GraphDB)

**Pour tester la connexion SPARQL dynamique**

1. **Installez et lancez GraphDB**

2. **Créez un repository**
   - Nom : `Gares_Frequentation_RCW`
   - *(ou modifiez l'URL dans `index.html`)*

3. **Importez les données**
   - Fichier : `gares.ttl` (dossier `/data`)

4. **Configurez CORS** 
   - Voir section [Résolution des problèmes CORS](#-résolution-des-problèmes-cors)

5. **Activez le mode SPARQL**
   - Cliquez sur **"📂 Fichier JSON"** → Passez en **"⚡ SPARQL Live"**

---

## 🔧 Résolution des problèmes CORS

### Symptôme
Erreur de connexion en mode "SPARQL Live" avec GraphDB (`localhost:7200`)

### Cause
Le navigateur bloque les requêtes cross-origin pour des raisons de sécurité

---

### ✅ Solution 1 : Configurer GraphDB (Recommandée)

**Lancement en ligne de commande**
```bash
graphdb -Dgraphdb.workbench.cors.enable=true
```

**Application de bureau**

1. Arrêtez GraphDB
2. Localisez le fichier de configuration :
   - Windows : `C:\Users\[Vous]\AppData\Local\GraphDB...\`
   - Fichier : `graphdb.properties` ou `GraphDB.cfg`
3. Ajoutez la ligne :
   ```properties
   graphdb.workbench.cors.enable=true
   ```
4. Redémarrez GraphDB

---

### 🔌 Solution 2 : Extension Navigateur (Temporaire)

**Chrome**
- Extension : *Allow CORS: Access-Control-Allow-Origin*

**Firefox**
- Extension : *CORS Everywhere*

> ⚠️ Activez l'extension **avant** de charger la page

---

## 🧠 Pipeline de Données

### Traitement ETL Sémantique

Les données sont enrichies via des requêtes SPARQL `INSERT` et `CONSTRUCT`

```
📥 Import
   ↓
   Données brutes SNCF (.ttl)
   
🧹 Nettoyage
   ↓
   Typage des propriétés (xsd:float, xsd:integer)
   
🌍 Enrichissement Départements
   ↓
   • Extraction via Code Postal de la gare
   • Requête fédérée vers Wikidata
   • SERVICE <https://query.wikidata.org/sparql>
   
🗺️ Enrichissement Régions
   ↓
   • Inférence depuis le nom du Département
   • Filtrage des anciennes régions (pré-2016)
   • Conservation des régions administratives actuelles
   
📤 Export Final
   ↓
   Graphe RDF propre avec préfixes (sncf:, schema:)
```

---

## 📁 Structure du Projet

```
sncf-data-viz/
├── 📄 index.html          # Structure HTML de l'application
├── 🎨 style.css           # Styles CSS (thème clair/sombre)
├── ⚙️ script.js           # Logique JavaScript (carte, graphiques, filtres)
├── 📊 gares.json          # Données statiques (mode autonome)
├── 📂 data/
│   └── gares.ttl          # Données RDF pour GraphDB
└── 📄 README.md           # Documentation du projet
```

### Description des fichiers

- **`index.html`** : Structure de la page avec la sidebar, la carte et les panneaux
- **`style.css`** : Styles personnalisés avec variables CSS pour le thème clair/sombre
- **`script.js`** : Fonctions principales
  - Gestion de la carte Leaflet
  - Requêtes SPARQL et chargement JSON
  - Rendu des graphiques Chart.js
  - Filtres et recherche
  - Gestion du thème
- **`gares.json`** : Export JSON des données pour le mode autonome
- **`data/gares.ttl`** : Données RDF enrichies pour GraphDB
