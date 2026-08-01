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
 *   #ad-rail-left            — left rail
 *   #ad-rail-right           — right rail
 *   #ad-strip-below-results  — strip below salary results
 */

const AD_SLOT_IDS = [
  "ad-rail-left",
  "ad-rail-right",
  "ad-strip-below-results",
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
    // Also hide any existing ad containers/scripts
    document.querySelectorAll(
      ".adsense-container, .adsbygoogle, [id^='adsense-'], [id*='monetag'], [class*='monetag'], iframe[src*='omg10.com']"
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
