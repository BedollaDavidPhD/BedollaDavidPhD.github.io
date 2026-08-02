# David Bedolla profile consistency review

Last reviewed: 2026-08-02

This file compares the portfolio website, downloadable PDF CV, Google Drive portfolio material, ChatGPT project history, and the editable Overleaf sources. It records the consistency decisions approved by David Bedolla and where they were applied.

## Status

All twelve decisions in the former unresolved-conflicts list were approved and applied on 2026-07-31. This document remains the source-of-truth record for future consistency reviews.

## Applied to the website and downloadable PDF now

| Field | Current standard |
| --- | --- |
| Display name | David Bedolla, PhD |
| Professional headline | Robotics Software Engineer \| Robot Manipulation, Whole-Body Control & Real-Time C++/ROS 2 \| Physical AI Deployment |
| Current organization | Lab INIT Robots |
| Location | Montréal, QC, Canada |
| Email | davidbedollamartinez@outlook.es |
| LinkedIn | linkedin.com/in/-davidbedolla |
| Website GitHub link | github.com/BedollaDavidPhD |
| ORCID | orcid.org/0000-0001-8552-6842 |
| Current role | Associate Researcher, March 2026-Present |
| Video portfolio | YouTube, muted autoplay when visible |

## Previously resolved decisions

### 1. Primary GitHub account

- Approved - `github.com/BedollaDavidPhD` (verified through GitHub authentication, linked consistently by the website and PDF, and used for the public portfolio repository)

Current website choice: Option A.

### 2. Professional headline

- Current standard - Robotics Software Engineer | Robot Manipulation, Whole-Body Control & Real-Time C++/ROS 2 | Physical AI Deployment

The website retains **Robotics Software Engineer** as the primary role and now uses the full LinkedIn positioning statement as the supporting headline. The downloadable CV remains unchanged by the 2026-08-02 LinkedIn alignment.

Current website choice: Option A.

### 3. Doctoral credential style

- Option A - David Bedolla, PhD

Conflict: the website request uses **PhD**; the previous website and PDF used **Ph.D.** The updated website and downloadable PDF now use **PhD**.

Current website choice: Option A.

### 4. PhD dates

- Option A - 2020-2023

Applied: the website and downloadable PDF now use **2020-2023**, and the dissertation entry uses **2023**.

### 5. Current role date

- Current standard - March 2026-Present

The website now uses the month-level date shown on LinkedIn. The downloadable CV remains unchanged by the 2026-08-02 LinkedIn alignment.

Current website choice: Option A.

### 6. 2024 race-vehicle project

- Option C - Keep it only in the longer CV

Applied: it remains in the longer downloadable CV and has been removed from the website.

### 7. Earlier academic roles on the website

- Option B - Keep both roles only in the CV

Conflict: both roles appear in the CV but are omitted from the website timeline.

### 8. City spelling

- Option A - Montréal

Conflict: the updated website and downloadable PDF use the French spelling with the accent; the uploaded LaTeX CV uses **Montreal**.

Current website choice: Option A.

### 9. Institution name

- Option C - ÉTS

Applied: the website and downloadable PDF now use **ÉTS**.

### 10. Video portfolio destination

- Option D - [APPLIED] Use YouTube with automatic playback while videos are visible and sound disabled. Continue editing this local project folder; the previous GitHub repository was deleted.

Conflict: the uploaded LaTeX CV links to a Google Drive video portfolio; the website now uses YouTube.


### 11. Publications link

- Option A - Keep direct DOI links for each publication in the web

Current website choice: Option A.

## LinkedIn alignment applied on 2026-08-02

- Aligned the website headline with robot manipulation, whole-body control, real-time C++/ROS 2, and Physical AI deployment.
- Reworked the public summary around task-level commands, robot models, sensor information, and dependable execution on physical robots.
- Added confirmed Lab INIT Robots responsibilities: 400 Hz whole-body control, analytical position-level redundancy, Pinocchio Jacobian joint-velocity control, joint-limit handling, super-twisting feedback, safe command processing, and teleoperation.
- Aligned the visible experience dates with the month-level LinkedIn dates for Lab INIT Robots, the postdoctoral role, Universidad Tecnológica de la Mixteca, and ÉTS research assistance.
- Preserved imitation learning and Diffusion Policy as future technology-transfer directions supported by teleoperation, IMU, EMG, and depth-camera experience. They are not listed as deployed policies or established production skills.
- Kept the previous decisions to omit earlier academic roles and the race-vehicle project from the shorter website timeline. Their absence is a curation choice, not a factual conflict.
- Copied no private street address or phone information into the public repository. The reviewed profile export remains unchanged and outside the repository.

## Consistent performance claims

These figures agree across the website and the available CV material:

- 400 Hz whole-body controller for a 10-DoF mobile manipulator
- Approximately 3 microseconds for Kinova Gen3 redundancy resolution
- 30x lower-limb control latency improvement
- 43 microseconds for rehabilitation inverse kinematics
- 1-4 kHz hard real-time exoskeleton control
- 387 microseconds for the learning-based predictive controller
- 20% tracking improvement for the 7-DoF optimization work
- 90% reduction in symbolic model-expression size
- 210 microseconds for feedforward-torque computation
- 5 microseconds for closed-form inverse kinematics

## Optional profile additions

- [APPLIED] Add ORCID `0000-0001-8552-6842` to the website and CV.
- [APPLIED] Use the professional email `davidbedollamartinez@outlook.es`.

## Corrections applied to the editable Overleaf sources

- Standardized document identity to **David Bedolla, PhD** outside formal publication citations.
- Changed the Publications headline from **Roboticist R&D** to **Robotics Software Engineer**.
- Replaced the ÉTS email with `davidbedollamartinez@outlook.es`.
- Verified the account and standardized the portfolio on `github.com/BedollaDavidPhD`.
- Corrected the doctoral dissertation year from **2024** to the confirmed **2023**.
- Corrected the Ranger-Kinova demo title and replaced the project description that had been placed incorrectly in the author field.
- Added the confirmed author name to the ÉTS exoskeleton project description.
- Removed the public phone number from the Publications project.
- Corrected the MSc dissertation/repository year to 2016.
- Corrected the ICARCV citation year to 2024.
- Relabeled items 13-18 as technical contributions to non-authored publications.
- Removed the unsupported 80% emergency-stop reduction figure from the STAR story.

## Approved decisions applied on 2026-07-31

### 1. Professional name versus publication name - APPLIED

Use `David Bedolla, PhD` for the website, CV header, interviews, and project documents. Retain `Bedolla-Martínez, D.` inside formal publication citations.

### 2. Phone-number visibility - APPLIED

Keep the phone only in private application documents. It is omitted from the website, public CV, and Publications LaTeX project.

### 3. Years-of-experience statement - APPLIED

Do not publish a single total; let the dated timeline demonstrate experience.

### 4. MSc dissertation/publication year - APPLIED

Keep the MSc dates as `2014-2016` and the dissertation/repository entry as `2016`.

### 5. ICARCV citation year - APPLIED

Use 2024. The Publications LaTeX source and website contribution list now agree.

### 6. Work on papers where you are not an author - APPLIED

Keep items 13-18 under **Technical Contributions to Non-Authored Publications**, never under authored publications.

### 7. Emergency-stop reduction claim - APPLIED

Keep the STAR story but remove the 80% figure. The revised result says the workflow helped reduce software-caused emergency stops.

### 8. Additional performance claims - APPLIED

Publish the 20% tracking improvement, 90% expression-size reduction, 210-microsecond feedforward-torque computation, and 5-microsecond closed-form inverse kinematics. All four now appear on the website and current CV.

### 9. Tools discussed but not yet demonstrated consistently - APPLIED

Do not list React, Three.js, Isaac Lab, MuJoCo, diffusion policies, imitation learning, or production bimanual manipulation as established skills until a demonstrable project exists.

### 10. Publications shown on the website - APPLIED

Keep three selected publications visible and provide expandable lists for the complete authored record and the separately labeled technical contributions.


### 11. Awards and scholarships - APPLIED

Add the ÉTS Excellence Award nomination and the doctoral/master's scholarships as a compact website section and include them in the current CV.

### 12. Outdated Google Drive files - APPLIED

Moved `David_Bedolla_CV_Eng.pdf`, `David_Bedolla_CV_R_D.pdf`, and the previous `David_Bedolla_CV.pdf` into `G:\My Drive\Portfolio\Archive - outdated`. Copied the finalized current CV to `G:\My Drive\Portfolio\David_Bedolla_CV.pdf`. The archived files remain recoverable.
