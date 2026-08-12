const navToggle = document.querySelector('.nav-toggle');
const siteNav = document.querySelector('.site-nav');
const themeToggle = document.querySelector('.theme-toggle');
const themeIcon = themeToggle?.querySelector('.theme-icon');
const themeLabel = themeToggle?.querySelector('.theme-label');
const themeColor = document.querySelector('meta[name="theme-color"]');

const syncThemeControl = () => {
  const isDark = document.documentElement.dataset.theme === 'dark';
  themeToggle?.setAttribute('aria-pressed', String(isDark));
  themeToggle?.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} theme`);
  if (themeIcon) themeIcon.textContent = isDark ? '☀' : '☾';
  if (themeLabel) themeLabel.textContent = isDark ? 'Light' : 'Dark';
  themeColor?.setAttribute('content', isDark ? '#08111f' : '#ffffff');
};

syncThemeControl();

themeToggle?.addEventListener('click', () => {
  const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = nextTheme;
  try {
    localStorage.setItem('portfolio-theme', nextTheme);
  } catch {
    // The theme still applies for this page view when storage is unavailable.
  }
  syncThemeControl();
});

const setNavigationOpen = (isOpen) => {
  siteNav?.classList.toggle('open', isOpen);
  navToggle?.setAttribute('aria-expanded', String(isOpen));
  navToggle?.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
};

navToggle?.addEventListener('click', () => {
  setNavigationOpen(!siteNav?.classList.contains('open'));
});

siteNav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    setNavigationOpen(false);
  });
});

document.addEventListener('click', (event) => {
  const clickedInsideNavigation = event.target instanceof Element && event.target.closest('.nav-wrap');
  if (siteNav?.classList.contains('open') && !clickedInsideNavigation) setNavigationOpen(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && siteNav?.classList.contains('open')) {
    setNavigationOpen(false);
    navToggle?.focus();
  }
});

const sectionNavLinks = [...(siteNav?.querySelectorAll('.nav-section-links a[href^="#"]') || [])];
const navigationSections = sectionNavLinks
  .map((link) => document.querySelector(link.getAttribute('href')))
  .filter(Boolean);

const setActiveNavigation = (sectionId) => {
  sectionNavLinks.forEach((link) => {
    const isActive = link.getAttribute('href') === `#${sectionId}`;
    link.classList.toggle('active', isActive);
    if (isActive) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
};

const updateActiveNavigation = () => {
  const activationLine = Math.min(220, window.innerHeight * 0.32);
  let activeSection = '';
  navigationSections.forEach((section) => {
    if (section.getBoundingClientRect().top <= activationLine) activeSection = section.id;
  });
  setActiveNavigation(activeSection);
};

let navigationFrame = 0;
const scheduleNavigationUpdate = () => {
  if (navigationFrame) return;
  navigationFrame = window.requestAnimationFrame(() => {
    navigationFrame = 0;
    updateActiveNavigation();
  });
};

sectionNavLinks.forEach((link) => {
  link.addEventListener('click', () => setActiveNavigation(link.hash.slice(1)));
});
window.addEventListener('scroll', scheduleNavigationUpdate, { passive: true });
window.addEventListener('resize', () => {
  if (window.innerWidth > 980) setNavigationOpen(false);
  scheduleNavigationUpdate();
});
window.addEventListener('hashchange', scheduleNavigationUpdate);
updateActiveNavigation();

const revealElements = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  revealElements.forEach((element) => observer.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add('visible'));
}

document.getElementById('year').textContent = new Date().getFullYear();

const youtubeIdFromUrl = (value) => {
  const raw = String(value || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;

  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    if (hostname === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || '';

    const queryId = url.searchParams.get('v');
    if (queryId) return queryId;

    const pathParts = url.pathname.split('/').filter(Boolean);
    const markerIndex = pathParts.findIndex((part) => ['embed', 'shorts', 'live'].includes(part));
    return markerIndex >= 0 ? pathParts[markerIndex + 1] || '' : '';
  } catch {
    return '';
  }
};

const mountProjectVideo = (project) => {
  const card = document.querySelector(`[data-project-id="${project.id}"]`);
  const youtubeId = youtubeIdFromUrl(project.youtubeUrl);
  if (!card || !/^[A-Za-z0-9_-]{11}$/.test(youtubeId)) return;

  card.classList.add('has-video');
  const title = card.querySelector('h3')?.textContent?.trim() || 'Robotics project video';
  const media = document.createElement('div');
  media.className = 'project-media project-video';

  const preview = document.createElement('div');
  preview.className = 'project-video-preview';
  const thumbnail = document.createElement('img');
  thumbnail.src = `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
  thumbnail.alt = '';
  thumbnail.loading = 'lazy';
  thumbnail.decoding = 'async';
  const label = document.createElement('span');
  label.textContent = 'Project video';
  preview.append(thumbnail, label);
  media.appendChild(preview);

  let iframe;
  let shouldPlay = false;
  const sendPlayerCommand = (command) => {
    iframe?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: command, args: [] }),
      '*'
    );
  };

  const mountPlayer = () => {
    if (iframe) return iframe;
    iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&mute=1&playsinline=1&controls=1&rel=0&enablejsapi=1&loop=1&playlist=${youtubeId}`;
    iframe.title = `${title} video`;
    iframe.loading = 'lazy';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;
    iframe.addEventListener('load', () => sendPlayerCommand(shouldPlay ? 'playVideo' : 'pauseVideo'));
    media.replaceChildren(iframe);
    return iframe;
  };

  const currentMedia = [...card.children].find((child) => child.matches('img, .project-media'));
  currentMedia?.replaceWith(media);

  if ('IntersectionObserver' in window) {
    const playbackObserver = new IntersectionObserver(
      ([entry]) => {
        shouldPlay = entry.isIntersecting;
        if (shouldPlay) {
          mountPlayer();
          sendPlayerCommand('playVideo');
        } else {
          sendPlayerCommand('pauseVideo');
        }
      },
      { threshold: 0.45 }
    );
    playbackObserver.observe(media);
  } else {
    shouldPlay = true;
    mountPlayer();
  }
};

if (document.querySelector('[data-project-id]')) {
  fetch('assets/data/project-media.json?v=20260812-tactile1')
    .then((response) => {
      if (!response.ok) throw new Error('Project media data could not be loaded.');
      return response.json();
    })
    .then((data) => {
      if (!Array.isArray(data.projects)) throw new Error('Project media must contain a projects list.');
      data.projects.forEach(mountProjectVideo);
    })
    .catch((error) => {
      console.warn('Project videos were not loaded; keeping the project illustrations.', error);
    });
}
