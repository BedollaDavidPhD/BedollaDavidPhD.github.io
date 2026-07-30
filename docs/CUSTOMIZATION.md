# Customization Guide

## 1. Personal information

Edit `index.html` and search for:

- `David Bedolla`
- `davidbedollamartinez@outlook.es`
- `https://github.com/BedollaDavidPhD`
- `https://www.linkedin.com/in/-davidbedolla`

## 2. Hero section

The first `<section class="hero">` contains the headline, role, summary, CV button, links, portrait, and impact metrics.

## 3. Projects

Each project is an `<article class="project-card">` inside the `#projects` section. Copy an existing project card to add another project.

Project illustrations are stored in `assets/images/`.

The video gallery in this section is controlled by `assets/data/videos.json`. See `docs/VIDEO_GUIDE.md` for the exact format.

## 4. Experience

Each role is an `<article class="timeline-item">` inside the `#experience` section.

## 5. Publications

Each publication is an `<article class="publication">` inside the `#publications` section. Verify every DOI before publishing.

## 6. Skills

Skill categories are `<article class="skill-card">` elements inside the `#skills` section.

## 7. Colors and layout

Edit CSS variables near the beginning of `assets/css/styles.css` to change the visual theme.

## 8. CV

Replace `documents/David_Bedolla_CV.pdf` with your latest CV while keeping the same filename, or update all CV links in `index.html`.

The source generator is available at `tools/create_cv_pdf.py`.

## 9. Repository rename

The current project URL includes the repository path:

`https://BedollaDavidPhD.github.io/BedollaDavid.github.io/`

For the shorter URL `https://BedollaDavidPhD.github.io/`, rename the repository to `BedollaDavidPhD.github.io`, then update the canonical URL in `index.html`, `robots.txt`, `sitemap.xml`, and `404.html`.

## 10. Profile consistency

Review `docs/PROFILE_CONSISTENCY_REVIEW.md` before changing titles, dates, account links, or degree formatting. It lists the differences found between the website and CV sources.
