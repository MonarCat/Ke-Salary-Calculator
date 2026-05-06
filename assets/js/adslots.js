/**
 * /assets/js/adslots.js
 *
 * Ad slot manager.
 * Hides all ads when isPremium === true (core premium value proposition).
 *
 * Usage:
 *   import { AdSlotManager } from './adslots.js';
 *   const adManager = new AdSlotManager();
 *   adManager.init(isPremium);
 *
 * Ad slot IDs must match the div IDs in your HTML:
 *   #ad-after-result  — below salary breakdown table
 *   #ad-sidebar       — desktop only (hidden ≤768px via CSS)
 *   #ad-homepage-mid  — homepage middle section
 */

const AD_SLOT_IDS = [
  "ad-after-result",
  "ad-sidebar",
  "ad-homepage-mid",
];

export class AdSlotManager {
  /**
   * Initialise ad slots.
   * @param {boolean} isPremium — if true, all ad slots are hidden and removed from flow.
   */
  init(isPremium) {
    if (isPremium) {
      this._hideAll();
    } else {
      this._showAll();
    }
  }

  _hideAll() {
    AD_SLOT_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = "none";
        el.setAttribute("aria-hidden", "true");
      }
    });
    // Also hide any existing AdSense containers
    document.querySelectorAll(
      ".adsense-container, .adsbygoogle, [id^='adsense-']"
    ).forEach((el) => {
      el.style.display = "none";
      el.setAttribute("aria-hidden", "true");
    });
  }

  _showAll() {
    AD_SLOT_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = "";
        el.removeAttribute("aria-hidden");
      }
    });
  }
}
