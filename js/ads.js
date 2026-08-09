(function () {
  const HOME_ADS = {
    bannerVideo: {
      campaignName: 'Afams Gardening House Ad',
      campaignSlug: 'afams_gardening_house_ad_video',
      source: '/assets/images/Afams AD.wmv',
      poster: '/assets/images/afams-house-ad.svg',
      fallbackHref: 'https://afams.co.ke/'
    },
    sidebarImages: [
      '/assets/images/growbag-hero.jpg',
      '/assets/images/full-starter-pack.png',
      '/assets/images/full-starterpack.png',
      '/assets/images/ChatGPT%20Image%20Jul%2023,%202026,%2007_14_44%20AM.png'
    ]
  };

  const BANNER_SLOT_SELECTOR = '[data-ad-slot="banner"]';
  const SIDEBAR_MEDIA_SELECTOR = '[data-ad-slot="sidebar-media"]';
  const SIDEBAR_ROTATION_MS = 9000;

  function buildTrackedHref(ad) {
    const url = new URL(ad.fallbackHref, window.location.origin);
    if (!url.searchParams.has('utm_source')) {
      url.searchParams.set('utm_source', 'salarycalculator');
    }
    if (!url.searchParams.has('utm_medium')) {
      url.searchParams.set('utm_medium', 'house_ad');
    }
    if (!url.searchParams.has('utm_campaign')) {
      url.searchParams.set('utm_campaign', ad.campaignSlug);
    }
    return url.toString();
  }

  function collapseSlot(slot) {
    slot.style.display = 'none';
    slot.setAttribute('data-ad-state', 'empty');
    slot.setAttribute('aria-hidden', 'true');
  }

  function setSlotReady(slot) {
    slot.style.display = '';
    slot.setAttribute('data-ad-state', 'ready');
    slot.removeAttribute('aria-hidden');
  }

  function canPlayWmvVideo() {
    const video = document.createElement('video');
    return typeof video.canPlayType === 'function' && video.canPlayType('video/x-ms-wmv') !== '';
  }

  function renderVideoBanner(slot, ad) {
    if (!ad?.source && !ad?.poster) {
      collapseSlot(slot);
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'sc-ad-banner sc-ad-banner--video';

    const label = document.createElement('span');
    label.className = 'sc-ad-label';
    label.textContent = 'Advertisement';

    const fallbackLink = document.createElement('a');
    fallbackLink.className = 'sc-ad-fallback-link';
    fallbackLink.href = buildTrackedHref(ad);
    fallbackLink.target = '_blank';
    fallbackLink.rel = 'noopener sponsored';
    fallbackLink.textContent = 'Open Afams ad';

    wrapper.appendChild(label);
    if (ad?.source && canPlayWmvVideo()) {
      const video = document.createElement('video');
      video.className = 'sc-ad-video';
      video.muted = true;
      video.autoplay = true;
      video.loop = true;
      video.playsInline = true;
      video.controls = true;
      video.poster = ad.poster || '';

      const source = document.createElement('source');
      source.src = ad.source;
      source.type = 'video/x-ms-wmv';
      video.appendChild(source);
      wrapper.appendChild(video);
    } else if (ad?.poster) {
      const posterLink = document.createElement('a');
      posterLink.className = 'sc-ad-link';
      posterLink.href = fallbackLink.href;
      posterLink.target = fallbackLink.target;
      posterLink.rel = fallbackLink.rel;
      posterLink.setAttribute('aria-label', 'Open Afams ad');

      const posterImage = document.createElement('img');
      posterImage.className = 'sc-ad-image';
      posterImage.src = ad.poster;
      posterImage.alt = 'Afams ad poster';
      posterImage.loading = 'lazy';
      posterImage.decoding = 'async';
      posterLink.appendChild(posterImage);
      wrapper.appendChild(posterLink);
    }
    wrapper.appendChild(fallbackLink);

    slot.innerHTML = '';
    slot.appendChild(wrapper);
    setSlotReady(slot);
  }

  function renderSidebarMedia(slot, images) {
    if (!Array.isArray(images) || images.length === 0) {
      collapseSlot(slot);
      return;
    }

    let index = 0;
    const wrapper = document.createElement('div');
    wrapper.className = 'sc-ad-banner sc-ad-banner--sidebar';

    const label = document.createElement('span');
    label.className = 'sc-ad-label';
    label.textContent = 'Advertisement';

    const image = document.createElement('img');
    image.className = 'sc-ad-image';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.alt = 'Afams promotional creative';

    const showImage = () => {
      image.src = images[index];
      index = (index + 1) % images.length;
    };

    wrapper.appendChild(label);
    wrapper.appendChild(image);
    slot.innerHTML = '';
    slot.appendChild(wrapper);

    showImage();
    setInterval(showImage, SIDEBAR_ROTATION_MS);
    setSlotReady(slot);
  }

  function initAds() {
    document.querySelectorAll(BANNER_SLOT_SELECTOR).forEach((slot) => {
      renderVideoBanner(slot, HOME_ADS.bannerVideo);
    });

    document.querySelectorAll(SIDEBAR_MEDIA_SELECTOR).forEach((slot) => {
      renderSidebarMedia(slot, HOME_ADS.sidebarImages);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAds);
  } else {
    initAds();
  }
})();
