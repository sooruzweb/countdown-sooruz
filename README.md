# Compte à rebours French Days 2026 — Soöruz

Header de newsletter Brevo : compte à rebours HH:MM:SS dans la police Soöruz, jaune `#ffdd00` sur noir `#000000`, pour les dernières 24h des French Days.

## Principe

Le JS ne tourne pas dans les clients mail. L'email affiche une image `https://TON-SITE.netlify.app/countdown.gif` : à chaque ouverture, une Netlify Function calcule le temps restant et renvoie un GIF animé de 60 s qui décompte à partir de ce moment.

- Zéro dépendance npm, zéro build : pas de `package.json`, rien à installer.
- La police n'est pas lue au runtime : les chiffres et textes sont pré-rendus dans `glyphs.mjs` par `tools/build_assets.py`.
- Chiffres proportionnels dans la police → chaque chiffre est centré dans une cellule de largeur fixe (sinon le compteur « danse »).
- Encodeur GIF maison : frame 0 pleine taille, puis seulement le rectangle qui change. Poids ~65 Ko.

## Arborescence

```
netlify.toml                              config Netlify (publish = public, fonctions)
public/index.html                         page de test (vraie date + fin dans 10 s)
netlify/functions/countdown/countdown.mjs fonction servie sur /countdown.gif
netlify/functions/countdown/glyphs.mjs    bitmaps générés (ne pas éditer)
tools/build_assets.py                     régénère glyphs.mjs (Python + Pillow)
tools/SooruzFont.otf                      police source
brevo-snippet.html                        bloc à coller dans Brevo
```

## Réglages rapides (countdown.mjs)

| Constante | Défaut | Rôle |
|---|---|---|
| `END` | `2026-09-28T23:59:59+02:00` | Date de fin, heure de Paris |
| `SECONDS` | `60` | Durée du GIF |
| `BLINK` | `false` | Deux-points qui clignotent (GIF ~300 Ko au lieu de ~65 Ko) |

Test sans toucher au code : `/countdown.gif?end=2026-09-28T23:59:59%2B02:00`

Plus de 99 h avant la fin : affiche 99:59:59 figé (normal si tu testes en avance). Après la fin : image fixe 00:00:00 + « LES FRENCH DAYS SONT TERMINÉS ».

Textes, tailles, couleurs, positions → en haut de `tools/build_assets.py`, puis relancer le script (nécessite Python + Pillow, donc un Claude avec exécution de code et la police uploadée).

## Déploiement (100 % navigateur)

1. GitHub → New repository (ex. `countdown-sooruz`) → « uploading an existing file » → glisser tout le contenu du dossier → Commit.
2. Netlify → ajouter un projet → importer depuis GitHub → choisir le repo → laisser build command vide → Deploy.
3. Vérifier que le site est public (pas de protection d'accès), sinon Gmail & co ne peuvent pas charger l'image.
4. Ouvrir `https://TON-SITE.netlify.app/` → la page de test doit afficher les deux compteurs.

Chaque commit sur GitHub redéploie automatiquement.

## Intégration Brevo

1. Coller `brevo-snippet.html` dans un bloc HTML en haut de l'email (remplacer `TON-SITE`, ajuster les UTM).
2. Utiliser une campagne classique, pas une automation (cache côté Brevo en automation).
3. Paramètres de campagne : option « Hide Image URL » sur No.
4. Envoyer un test sur Gmail, Apple Mail et Outlook avant la vraie campagne.

## Limites connues

- Gmail met parfois l'image en cache : à la réouverture du mail, le compteur peut repartir de la valeur de la première ouverture.
- Outlook desktop n'affiche que la première frame (qui est exacte).
- Apple Mail Privacy peut précharger l'image à la réception : le décompte peut avoir quelques minutes de retard à l'ouverture.

## Police Soöruz (SooruzFont.otf)

Tout en capitales (les minuscules affichent les capitales). Accents OK : À Â Ç É È Ê Ô Ö Ù. Accents absents (lettre sans accent) : Î Ï Û Ü Ë Ÿ. Glyphes absents : `# @ — – … _`. Éviter ces caractères dans les textes pré-rendus.
