(function () {
  const CURRENT_AD = {
    campaignName: 'Afams House Ad',
    campaignSlug: 'afams_house_ad',
    imageSrc: '/assets/images/afams-house-ad.svg',
    altText: 'Afams HR, payroll, and staffing solutions for Kenyan businesses',
    href: 'https://afams.co.ke/'
  };

  const BANNER_SLOT_SELECTOR = '[data-ad-slot="banner"]';

  function canRenderAd(ad) {
    return Boolean(
      ad &&
      ad.campaignSlug &&
      ad.imageSrc &&
      ad.altText &&
      ad.href
    );
  }

  function buildTrackedHref(ad) {
    return ad.href +
      '?utm_source=salarycalculator&utm_medium=house_ad&utm_campaign=' +
      encodeURIComponent(ad.campaignSlug);
  }

  function collapseSlot(slot) {
    slot.style.display = 'none';
    slot.setAttribute('data-ad-state', 'empty');
    slot.setAttribute('aria-hidden', 'true');
  }

  function renderBanner(slot, ad) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sc-ad-banner';

    const label = document.createElement('span');
    label.className = 'sc-ad-label';
    label.textContent = 'Advertisement';

    const link = document.createElement('a');
    link.className = 'sc-ad-link';
    link.href = buildTrackedHref(ad);
    link.target = '_blank';
    link.rel = 'noopener sponsored';
    link.setAttribute('aria-label', ad.campaignName + ' advertisement');

    const image = document.createElement('img');
    image.className = 'sc-ad-image';
    image.src = ad.imageSrc;
    image.alt = ad.altText;
    image.loading = 'lazy';
    image.decoding = 'async';

    link.appendChild(image);
    wrapper.appendChild(label);
    wrapper.appendChild(link);

    slot.innerHTML = '';
    slot.appendChild(wrapper);
    slot.style.display = '';
    slot.setAttribute('data-ad-state', 'ready');
    slot.removeAttribute('aria-hidden');
  }

  function initAds() {
    const slots = document.querySelectorAll(BANNER_SLOT_SELECTOR);
    if (!slots.length) {
      return;
    }

    if (!canRenderAd(CURRENT_AD)) {
      slots.forEach(collapseSlot);
      return;
    }

    slots.forEach(function (slot) {
      renderBanner(slot, CURRENT_AD);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAds);
  } else {
    initAds();
  }
})();
