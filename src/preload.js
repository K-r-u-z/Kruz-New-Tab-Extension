(() => {
  const BLUR_SLIDER_MAX = 24;
  const BLUR_MAX_PX = 12;

  function blurPxFromSliderValue(v) {
    const n = Math.max(0, Math.min(BLUR_SLIDER_MAX, Number(v) || 0));
    const t = n / BLUR_SLIDER_MAX;
    const eased = t * t; // gentle ease-in
    return Math.round(eased * BLUR_MAX_PX);
  }

  try {
    const bg = localStorage.getItem('helium_customBackground');
    if (bg) {
      document.documentElement.style.setProperty('--preload-bg-image', `url("${bg}")`);
      document.documentElement.classList.add('has-preload-bg');
    }

    const blurSliderRaw = localStorage.getItem('helium_customBackgroundBlur');
    if (blurSliderRaw !== null) {
      const px = blurPxFromSliderValue(blurSliderRaw);
      document.documentElement.style.setProperty('--bg-blur', `${px}px`);
    }
  } catch (_) {}
})();
