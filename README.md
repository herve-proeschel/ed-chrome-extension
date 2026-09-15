# ED Impression

Extension Chrome Manifest V3 pour imprimer proprement le cahier de texte et l'emploi du temps ÉcoleDirecte.

## Fonctionnalités

- Impression des devoirs à venir avec leurs détails et les éventuelles évaluations.
- Impression de l'emploi du temps complet du lundi au vendredi.
- Mise en page **A4 paysage** pour l'emploi du temps.
- Échelle horaire commune de **08:00 à 18:00**.
- Activités positionnées selon leur heure de début et dimensionnées selon leur durée.
- Affichage des matières, horaires, salles, professeurs, groupes et cours annulés.
- Bouton d'action accessible depuis les pages concernées d'ÉcoleDirecte.

## Installation locale

1. Ouvrir `chrome://extensions` dans Chrome ou Chromium.
2. Activer le **Mode développeur**.
3. Cliquer sur **Charger l'extension non empaquetée**.
4. Sélectionner le dossier `ed-chrome-extension`.

Après chaque modification du code, cliquer sur **Recharger** dans la carte de l'extension, puis actualiser la page ÉcoleDirecte.

## Utilisation

Ouvrir l'une des pages suivantes lorsque la session ÉcoleDirecte est active :

- le cahier de texte ou la page des travaux à faire pour imprimer les devoirs à venir ;
- `/E/<identifiant>/EmploiDuTemps` pour imprimer l'emploi du temps de la semaine.

Le bouton flottant apparaît automatiquement. L'impression reprend les créneaux de l'emploi du temps actuellement affiché, du lundi au vendredi, puis les place sur une échelle de 08:00 à 18:00. Les espaces libres entre deux cours sont conservés.

## Dépannage

- Si le bouton n'apparaît pas, recharger l'extension dans `chrome://extensions`, puis faire `Ctrl+F5` sur ÉcoleDirecte.
- Si Chrome signale un problème de permission ou de manifeste, vérifier que le dossier sélectionné contient bien `manifest.json`.
- Les fenêtres pop-up doivent être autorisées pour le site afin d'ouvrir la feuille d'impression.

L'extension utilise uniquement un script de contenu sur `ecoledirecte.com` et ne demande aucune permission supplémentaire.
