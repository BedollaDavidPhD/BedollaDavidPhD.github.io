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

navToggle?.addEventListener('click', () => {
  const isOpen = siteNav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(isOpen));
  navToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
});

siteNav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    siteNav.classList.remove('open');
    navToggle?.setAttribute('aria-expanded', 'false');
  });
});

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

const videoGrid = document.getElementById('video-grid');

const makeTextElement = (tag, className, value) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value;
  return element;
};

const renderVideo = (video) => {
  const card = document.createElement('article');
  card.className = 'video-card';

  const frame = document.createElement('div');
  frame.className = 'video-frame';

  const preview = document.createElement('div');
  preview.className = 'video-preview';

  const thumbnail = document.createElement('img');
  thumbnail.className = 'video-thumbnail';
  thumbnail.src = `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`;
  thumbnail.alt = '';
  thumbnail.width = 480;
  thumbnail.height = 360;
  thumbnail.loading = 'lazy';
  thumbnail.decoding = 'async';

  const mutedIcon = makeTextElement('span', 'video-muted-icon', '🔇');
  mutedIcon.setAttribute('aria-hidden', 'true');
  const autoplayLabel = makeTextElement('span', 'video-autoplay-label', 'Autoplays muted');
  preview.append(thumbnail, mutedIcon, autoplayLabel);
  frame.appendChild(preview);

  let iframe;
  let shouldPlay = false;
  const mountPlayer = () => {
    if (iframe) return;
    const player = document.createElement('iframe');
    player.src = `https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&mute=1&playsinline=1&controls=1&rel=0&enablejsapi=1&loop=1&playlist=${video.youtubeId}`;
    player.title = video.title;
    player.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    player.referrerPolicy = 'strict-origin-when-cross-origin';
    player.allowFullscreen = true;
    player.addEventListener('load', () => {
      sendPlayerCommand(shouldPlay ? 'playVideo' : 'pauseVideo');
    });
    frame.replaceChildren(player);
    return player;
  };

  const sendPlayerCommand = (command) => {
    iframe?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: command, args: [] }),
      '*'
    );
  };

  if ('IntersectionObserver' in window) {
    const playbackObserver = new IntersectionObserver(
      ([entry]) => {
        shouldPlay = entry.isIntersecting;
        if (entry.isIntersecting) {
          iframe = mountPlayer() || iframe;
          sendPlayerCommand('playVideo');
        } else {
          sendPlayerCommand('pauseVideo');
        }
      },
      { threshold: 0.45 }
    );
    playbackObserver.observe(frame);
  } else {
    shouldPlay = true;
    iframe = mountPlayer();
  }

  const body = document.createElement('div');
  body.className = 'video-body';
  body.appendChild(makeTextElement('span', 'video-category', video.category || 'Robotics demo'));
  body.appendChild(makeTextElement('h4', '', video.title));
  body.appendChild(makeTextElement('p', '', video.description || 'Robotics engineering demonstration.'));
  const youtubeLink = makeTextElement('a', 'video-link', 'Open on YouTube');
  youtubeLink.href = `https://youtu.be/${video.youtubeId}`;
  youtubeLink.target = '_blank';
  youtubeLink.rel = 'noopener';
  body.appendChild(youtubeLink);

  card.append(frame, body);
  return card;
};

if (videoGrid) {
  fetch('assets/data/videos.json')
    .then((response) => {
      if (!response.ok) throw new Error('Video data could not be loaded.');
      return response.json();
    })
    .then((videos) => {
      const validVideos = videos.filter(
        (video) =>
          typeof video.title === 'string' &&
          typeof video.youtubeId === 'string' &&
          /^[A-Za-z0-9_-]{11}$/.test(video.youtubeId)
      );

      if (!validVideos.length) throw new Error('No valid videos are available.');
      videoGrid.replaceChildren(...validVideos.map(renderVideo));
    })
    .catch(() => {
      const fallback = document.createElement('p');
      fallback.className = 'video-status';
      fallback.append('The embedded playlist is unavailable. ');

      const link = document.createElement('a');
      link.href = 'https://youtu.be/4rHsXWw5kek';
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Watch the robotics portfolio on YouTube.';
      fallback.appendChild(link);
      videoGrid.replaceChildren(fallback);
    });
}
