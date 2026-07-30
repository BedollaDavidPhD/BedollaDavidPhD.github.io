const navToggle = document.querySelector('.nav-toggle');
const siteNav = document.querySelector('.site-nav');

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

  const playButton = document.createElement('button');
  playButton.className = 'video-load';
  playButton.type = 'button';
  playButton.setAttribute('aria-label', `Play video: ${video.title}`);

  const thumbnail = document.createElement('img');
  thumbnail.className = 'video-thumbnail';
  thumbnail.src = `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`;
  thumbnail.alt = '';
  thumbnail.width = 480;
  thumbnail.height = 360;
  thumbnail.loading = 'lazy';
  thumbnail.decoding = 'async';

  const playIcon = makeTextElement('span', 'video-play-icon', '▶');
  playIcon.setAttribute('aria-hidden', 'true');
  const playLabel = makeTextElement('span', 'video-play-label', 'Play video');
  playButton.append(thumbnail, playIcon, playLabel);
  frame.appendChild(playButton);

  playButton.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1`;
    iframe.title = video.title;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;
    frame.replaceChildren(iframe);
  });

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
