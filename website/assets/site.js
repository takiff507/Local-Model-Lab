const menuButton = document.querySelector('.menu-button');
const navigation = document.querySelector('.site-nav');

if (menuButton && navigation) {
  menuButton.addEventListener('click', () => {
    const isOpen = navigation.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
    menuButton.textContent = isOpen ? 'Close' : 'Menu';
  });

  navigation.addEventListener('click', event => {
    if (event.target instanceof HTMLAnchorElement) {
      navigation.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.textContent = 'Menu';
    }
  });
}

const downloadLinks = document.querySelectorAll('[data-release-download]');
const hostMatch = window.location.hostname.match(/^([^.]+)\.github\.io$/i);
const repository = window.location.pathname.split('/').filter(Boolean)[0];

if (hostMatch && repository) {
  const owner = hostMatch[1];
  const releaseUrl = `https://github.com/${owner}/${repository}/releases/latest/download/Local-Model-Lab-Windows-x64.exe`;
  downloadLinks.forEach(link => {
    link.href = releaseUrl;
    link.setAttribute('rel', 'noopener');
  });
}