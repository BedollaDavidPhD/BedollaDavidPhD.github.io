# David Bedolla Robotics Portfolio

Complete static portfolio project for:

- Intended repository to create or recreate: `https://github.com/BedollaDavidPhD/BedollaDavid.github.io`
- Intended GitHub Pages URL: `https://BedollaDavidPhD.github.io/BedollaDavid.github.io/`

The local project folder is the current source of truth. The previous GitHub repository was deleted, so recreate it before following the deployment steps.

The project uses plain HTML, CSS, and JavaScript. It has no framework, package manager, or build dependency.

The optional `tools/build_sites_preview.mjs` script packages the same static files for a private Sites preview; it does not change the GitHub Pages workflow.

## Presentation and behavior

- The live page uses the original-quality profile photo, INIT Robots logo, and social card.
- Visitors can switch between a clear light theme and a high-contrast dark theme.
- The theme follows the visitor’s system preference on first visit and remembers their choice.
- Project illustrations load only when visitors approach them.
- YouTube demonstrations start automatically, muted, when they enter the viewport and pause after leaving it.

## Deploy to GitHub Pages

1. Create or recreate the `BedollaDavid.github.io` repository under `BedollaDavidPhD`.
2. Extract `David_Bedolla_GitHub_Pages_Full_Quality.zip`.
3. Upload all extracted files and folders to the root of the repository's `main` branch.
4. Confirm that `index.html` is at the repository root.
5. Open **Settings > Pages** in GitHub.
6. Choose **Deploy from a branch**.
7. Select `main` and `/(root)`.
8. Save.

Do not upload the enclosing project folder as an additional directory inside the repository.

## Local preview

From the project directory, run:

```bash
python -m http.server 8000
```

Open `http://localhost:8000` in a browser.

## Main files

- `index.html`: website content and structure
- `assets/css/styles.css`: responsive design
- `assets/js/main.js`: navigation, animations, and footer year
- `assets/images/`: profile placeholder and project illustrations
- `assets/images/profile.jpg`: original-quality profile image used by the website
- `assets/images/init-robots-logo.png`: original-quality INIT Robots logo used by the website
- `assets/data/videos.json`: editable YouTube portfolio list
- `documents/David_Bedolla_CV.pdf`: downloadable CV
- `tools/create_cv_pdf.py`: editable CV PDF generation source
- `tools/build_sites_preview.mjs`: private preview packaging helper
- `docs/PROFILE_CONSISTENCY_REVIEW.md`: decisions needed to align the website and CV
- `404.html`: custom not-found page
- `robots.txt` and `sitemap.xml`: search-engine metadata
- `.nojekyll`: prevents Jekyll processing

## Replace the profile illustration

Add a professional photo as:

`assets/images/profile.jpg`

Then replace this line in `index.html`:

```html
<img src="assets/images/profile-placeholder.svg" alt="David Bedolla profile placeholder">
```

with:

```html
<img src="assets/images/profile.jpg" alt="Portrait of David Bedolla">
```

## Information to verify

Before sharing the site publicly, review the email, LinkedIn URL, employment dates, impact metrics, publication details, and CV contents.

See `docs/CUSTOMIZATION.md` for a detailed editing guide.
