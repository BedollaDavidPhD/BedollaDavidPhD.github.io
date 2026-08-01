# Changelog

## Version 2.26 - Controlled-Variable Plot Legends

- Replaced generic primary and secondary plot legends with the controlled variables shown by each simulator
- Added matching English, Spanish, and French labels for joint angles, arm angle, altitude, yaw, and roll

## Version 2.25 - Unified Articulated Rotor Dynamics

- Moved Drone4, Copter1, and Copter2 onto the Featherstone articulated-body simulation path already used by Drone6 and TaxiDrone
- Applied rotor thrust and drag, motor delay, effort and power limits, encoder quantization, and state estimation to all five rotor systems
- Removed rotor-count normalization from multirotor allocation and tuned TaxiDrone gains for its direct 18-rotor mixer
- Standardized every interactive simulation to 10 seconds
- Added request, RK4-stage, estimator, output-buffer, and metric checks that reject NaN, Infinity, and numerical blow-up

## Version 2.24 - One-Line CV Contact Header

- Arranged My page, LinkedIn, email, and Montréal location on one line in the CV header
- Preserved clickable portfolio, LinkedIn, and email links

## Version 2.23 - CV Contact Links

- Replaced the displayed portfolio URL in the CV with a natural "My page" hyperlink
- Removed GitHub and ORCID from the CV contact block
- Simplified the LinkedIn label while retaining its destination

## Version 2.22 - Direct Simulator Copy

- Rewrote simulator descriptions as concise engineering summaries
- Removed internal model-format terminology and validation-process language from public content

## Version 2.21 - Clean Model Geometry

- Removed visualization-only pedestal cylinders from the manipulator, Copter1, and Copter2 demos
- Preserved the original CAD links, kinematic links, frames, centers of mass, and motion

## Version 2.20 - Multirotor Dynamics Fidelity

- Replaced the decoupled Drone6 and TaxiDrone browser plants with articulated-body dynamics, rotor thrust and drag, RK4 integration, motor delay, effort and power limits, encoder quantization, and state estimation
- Restored physical attitude-to-translation coupling so roll and pitch redirect thrust and produce lateral motion
- Normalized the TaxiDrone allocator across its 18 rotors and retuned stable editable defaults for the higher-fidelity plant
- Added accessible, translated information controls only beside proportional, integral, and derivative gains

## Version 2.19 - Trilingual Engineering Portfolio

- Added a persistent English, Spanish, and French language selector to the site header
- Added reviewed engineering translations for the portfolio, experience, education, skills, contact content, accessibility labels, and interactive simulator
- Kept official publication titles, software names, product names, abbreviations, and units in their authoritative form
- Added the translation catalogue and runtime to the GitHub Pages and Sites builds

## Version 2.18 - Portfolio Link in CV

- Added the live GitHub Pages portfolio as a clickable contact link in the CV PDF
- Refreshed the website's CV links so browsers load the updated document

## Version 2.17 - Public GitHub Pages Repository

- Removed the generic case-study promise from the portfolio heading
- Removed the standalone Dynamics Forge and robotics-tooling project cards while retaining the interactive simulator
- Updated website, documentation, sitemap, social metadata, and CV source for the verified `BedollaDavidPhD` GitHub account and root Pages URL

## Version 2.16 - URDF-Driven Trajectory Planner Video

- Added the C++ trajectory-planning application to the right side of the learning-based controller row
- Documented URDF-driven joint generation, joint and Cartesian planning, damped least-squares inverse kinematics, B-spline and blended paths, Ruckig limits, trajectory derivatives, and OpenGL visualization
- Included confirmed lock-free data flow, batched kinematics, and asynchronous 3D-overlay architecture from the PlannerGUI implementation history

## Version 2.15 - Learning-Based Predictive Control

- Added a full-width fourth-row video case study for the ETS-MARSE learning-based predictive controller
- Documented Gaussian Process mean and uncertainty, constrained MPC, robust sliding-mode compensation, and 387 μs physical-system iterations
- Separated the four whole-body progression cards into non-repeating analytical-arm, real-arm, analytical-whole-body, and deployed-whole-body scopes

## Version 2.14 - Analytical Method Videos

- Added the analytical 7-DoF redundancy-resolution video to its project card
- Added the analytical whole-body redundancy-resolution video to the 10-DoF mobile-manipulator card
- Completed both analytical/implementation rows with paired vertical videos

## Version 2.13 - Redundancy-Resolution Series

- Reorganized the project grid with mirror rehabilitation as a featured first row
- Paired the analytical 7-DoF method with its real-hardware implementation in the second row
- Paired analytical 10-DoF whole-body redundancy resolution with its world-frame implementation in the third row
- Documented the 1.05-million-solution computational result, geometric swivel-angle formulation, task-priority whole-body method, filtered odometry, and 400 Hz onboard implementation

## Version 2.12 - Real-Time Redundancy Resolution and Larger Videos

- Corrected the null-space-control video URL and described its real-hardware Kinova Gen3 implementation
- Assigned the 3 μs result specifically to the analytical redundancy-resolution computation
- Enlarged vertical videos by about 1.6× on desktop and tightened description spacing to retain consistent card dimensions
- Reduced center-of-mass dots by 50% and removed their internal plus marks

## Version 2.11 - Mirror-Rehabilitation Exoskeleton Video

- Embedded the mirror-rehabilitation YouTube Short in the rehabilitation-robotics case study
- Reframed the card around unaffected-arm motion capture, two wearable IMUs, surface-EMG wrist estimation, and 7-DoF exoskeleton trajectory generation
- Highlighted physical assistance, proprioceptive and kinesthetic feedback, human-oriented inverse kinematics, smooth trajectories, and the real-time control stack

## Version 2.10 - Real-Time Redundancy-Resolution Demo

- Added the PS4-controlled Kinova Gen3 redundancy-resolution video as a separate project card
- Placed the real-time null-space-control demonstration on the left and the world-frame demonstration on the right of the first desktop row
- Documented Cartesian twist and pose commands, null-space swivel-angle control, inverse kinematics, and command multiplexing

## Version 2.9 - Vertical Project Video Cards

- Changed configured project videos from landscape to a 9:16 phone-video frame
- Placed vertical videos to the left of project descriptions while retaining two project cards per row on desktop
- Switched to one card per row on tablets and stacked videos above their descriptions on narrow phones

## Version 2.8 - World-Frame Mobile-Manipulation Video

- Embedded the first YouTube Short in the mobile-manipulation case study
- Reframed the card around world-frame end-effector pose tracking as the primary task and swivel-angle redundancy resolution as the secondary task
- Added the verified filtered-odometry transform, 400 Hz ROS 2 Jazzy/C++ control pipeline, PS4 joystick, and multi-node coordination details
- Kept the silent video muted by default without implying that an audio track is required

## Version 2.7 - Project Videos and Center-of-Mass Layer

- Added a dedicated COM viewer layer with configured mass locations for all six interactive systems
- Doubled the displayed INIT Robots logo from 24 px to 48 px
- Removed the separate video-portfolio gallery from the page
- Added `assets/data/project-media.json` so a full YouTube URL can replace any Research and engineering work illustration while blank URLs retain the original art
- Kept project videos lazy-loaded, muted on entry, controllable through YouTube, and paused outside the viewport

## Version 2.6 - Visible Rotor Frame Motion

- Bound the displayed Copter1, Drone4, and Drone6 rotor frames to the same rotating transforms as their propeller CAD
- Kept frame-axis scale independent from the CAD mesh scale
- Made rotor rotation visible when CAD is disabled and the Frames layer remains enabled

## Version 2.5 - Responsive Section Selector

- Rebuilt the top navigation as a compact segmented section selector with a distinct CV PDF action
- Added automatic current-section highlighting while scrolling
- Improved light and dark theme styling, keyboard focus states, and medium-width spacing
- Reworked the mobile menu with larger targets, an animated menu button, outside-click closing, and Escape-key support

## Version 2.4 - TaxiDrone Full-Pose Control

- Expanded TaxiDrone from altitude-only control to XYZ position and roll/pitch/yaw control
- Matched TaxiDrone's editable gains, targets, integrator initial values, plots, and metrics to the Drone6 full-control interface
- Applied all six pose coordinates through the TaxiDrone modified-DH chain before placing its 18 configured rotors
- Expanded TaxiDrone's reset bounds to preserve the complete vehicle during translated and tilted views

## Version 2.3 - Light Sections, TaxiDrone, and Native Copter Paths

- Made the simulator, video portfolio, and experience sections light in light mode while preserving their dark-theme treatments
- Kept the contact section intentionally colored in both themes as the final call to action
- Reordered the simulator tabs to Arm, Copter1, Copter2, Drone4, Drone6, and TaxiDrone
- Added TaxiDrone with all 18 rotor locations and configured motor directions
- Configured cubic trajectories for Copter1 and Copter2

## Version 2.2 - Frame and Copter2 Alignment

- Corrected the 2-DoF manipulator viewer to use the model's modified-DH local Z joint axes instead of hand-authored Y rotations
- Rebuilt Copter2's frames, offsets, parent links, rotor joints, and rotor directions from the source model
- Replaced the independent yaw/roll approximation with a cascaded yaw-to-roll reference controller and configured gains
- Added motor lag, effort/power limits, friction, rotor thrust, and drag terms to the lightweight Copter2 browser plant
- Removed the independent Copter2 roll target and plotted the generated roll reference against measured roll
- Updated asset version identifiers so a refresh loads the corrected scripts and configuration

## Version 2.1 - Expanded Aerial Control Demos

- Added Drone4 altitude and yaw PID control with separate targets and initial integral states
- Added Copter1 arm-angle control and Copter2 yaw/roll control
- Replaced cart-pole with Drone6 full XYZ and roll/pitch/yaw control
- Added full 3D, top, front, and side views that reset to the configured full limits for every run and replay
- Changed the main action to Replay after a completed result and back to Run simulation only after a parameter changes
- Allowed two new numerical recalculations per rolling minute while keeping Replay unlimited

## Version 2.0 - Live Dynamics Forge Web Demos

- Replaced the replay-only viewer with three browser-side nonlinear simulations: manipulator, quadrotor, and cart-pole
- Added editable PID and full-state feedback gains with rerun, reset, playback, and response plots
- Added exported STL CAD plus independent CAD, link, coordinate-frame, and frame-label layers
- Moved numerical integration to a Web Worker so the portfolio UI remains responsive
- Removed implementation-conversation copy from the public section

## Version 1.8 - Interactive Dynamics Forge Replays

- Added four interactive browser replays exported from verified Dynamics Forge native C++ simulations
- Added rotate, pan, zoom, timeline, speed, restart, and accessible keyboard controls
- Kept the demos independent from Python, FastAPI, tunnels, and external runtime services for GitHub Pages reliability
- Added an exporter and documentation for updating or adding simulation examples
- Deferred loading until the simulator section approaches the viewport and paused rendering when off-screen

## Version 1.7 - Approved Consistency Decisions

- Published the approved 20%, 90%, 210 microsecond, and 5 microsecond engineering metrics
- Added a compact Awards and Scholarships section to the website and CV
- Added expandable complete-authored and non-authored technical-contribution publication lists
- Corrected the public LaTeX sources for phone visibility, MSc year, ICARCV year, and emergency-stop wording
- Regenerated and visually verified the current two-page PDF CV
- Archived the three superseded Google Drive CVs and replaced the root Drive CV with the finalized version

## Version 1.6 - Verified Portfolio Depth and Source Alignment

- Renamed the main work navigation item to Portfolio while keeping Research and Engineering Work as the section heading
- Expanded the four engineering case studies with verified mobile-manipulation, exoskeleton, Dynamics Forge, modeling, and planning details
- Added a compact education section and verified software-systems tools
- Aligned the editable Overleaf sources with the confirmed name, headline, email, GitHub account, and dissertation year
- Added a new unresolved-conflicts decision list without publishing unverified claims

## Version 1.5 - Local Source and Multi-Video Gallery

- Removed generated download packages so the local project folder is the only source of truth
- Removed the long portfolio overview video
- Prepared the gallery for multiple short project videos with individual titles, categories, and descriptions
- Kept automatic playback muted when a video first enters view and pause behavior when it leaves
- Added a copy-ready multi-video example file and simplified editing instructions

## Version 1.4 - Full Quality and Theme Controls

- Restored the original-quality profile photo, INIT Robots logo, and social card
- Added a persistent light/dark theme button with system-preference detection
- Added muted YouTube autoplay when videos enter the viewport and pause behavior when they leave
- Applied the confirmed profile choices, including the Outlook email, ORCID, ÉTS naming, and PhD dates
- Removed race-vehicle work from the website while preserving it in the longer CV

## Version 1.3 - GitHub Pages Performance

- Reduced the profile image served to visitors from about 710 KB to about 69 KB
- Reduced the served INIT Robots logo from about 37 KB to about 17 KB
- Reduced the social preview image from about 1.57 MB to about 82 KB
- Replaced the initial YouTube embed with a click-to-load preview
- Added lazy loading for below-the-fold project imagery
- Made revealed content remain readable when JavaScript is unavailable

## Version 1.2 - Industry Positioning and Video Portfolio

- Kept “David Bedolla, PhD” on one responsive hero line
- Centered and enlarged the Robotics Software Engineer and Lab INIT Robots lockup
- Added the supplied INIT Robots logo
- Reframed the portfolio around engineering delivery, integration, performance, safety, and validation
- Added a YouTube gallery controlled by `assets/data/videos.json`
- Added video-editing instructions and a website/CV consistency review
- Added a custom social preview image and matching metadata

## Version 1.1 - Full Project Package

- Organized CSS and JavaScript into `assets/css` and `assets/js`
- Included all SVG illustrations and the profile placeholder
- Included the downloadable CV PDF
- Included the editable CV generator source
- Added deployment and customization documentation
- Added `.gitignore`, license, web manifest, sitemap, robots file, and `.nojekyll`
- Configured metadata for the current GitHub project-site URL

## Version 1.0

- Initial responsive single-page robotics portfolio
