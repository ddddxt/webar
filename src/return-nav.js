// Navigation only: the existing AR scene and tracking script stay unchanged.
(() => {
  const back = document.querySelector('.tryon-page > .back-button');
  if (!back || back.dataset.returnReady === 'true') return;
  back.dataset.returnReady = 'true';

  if (document.referrer) {
    const source = new URL(document.referrer);
    const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(source.hostname);
    if (['http:', 'https:'].includes(source.protocol) &&
        (localHost || source.hostname === location.hostname) &&
        source.origin !== location.origin) {
      back.href = new URL('/world/world.html#craft', source.origin).href;
    } else if (source.pathname.endsWith('/world/world.html')) {
      source.hash = 'craft';
      back.href = source.href;
    }
  }

  const releaseCamera = () => {
    const video = document.getElementById('video');
    const stream = video?.srcObject;
    if (!stream || typeof stream.getTracks !== 'function') return;
    stream.getTracks().forEach(track => track.stop());
    video.pause();
    video.srcObject = null;
  };

  back.addEventListener('click', event => {
    if (!event.defaultPrevented && event.button === 0 &&
        !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      releaseCamera();
    }
  });
  window.addEventListener('pagehide', releaseCamera);
})();
