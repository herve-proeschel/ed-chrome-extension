# ED Impression

Extension Chrome Manifest V3 qui ajoute une impression propre et lisible des devoirs a venir dans le cahier de texte ÉcoleDirecte.

## Installation locale

1. Ouvrir `chrome://extensions` dans Chrome.
2. Activer le **Mode developpeur**.
3. Cliquer sur **Charger l'extension non empaquetée**.
4. Selectionner ce dossier.

Le bouton d'impression apparait automatiquement dans les pages du cahier de texte et de l'emploi du temps. Sur une page `EmploiDuTemps`, il recupere les cours du lundi au vendredi depuis l'API ÉcoleDirecte et genere une mise en page hebdomadaire au format **A4 paysage** avec les horaires, matieres, salles, professeurs, groupes et cours annules.

L'extension utilise uniquement le script de contenu sur `ecoledirecte.com` et ne demande aucune permission supplementaire.
