/** React-free so the root (server) layout can inline the boot script. */
export const APPEARANCE_KEY = "fo:appearance";
export const THEME_CACHE_KEY = "fo:themeVars";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs inline in <head> before first paint: applies the remembered palette and
 * mode so a light-mode or plain-style user never sees a dark/colourful flash.
 */
export const BOOT_SCRIPT = `(function(){try{var d=document.documentElement;var a=JSON.parse(localStorage.getItem(${JSON.stringify(APPEARANCE_KEY)})||"{}");var m=a.mode||"dark";var l=m==="light"||(m==="system"&&!matchMedia(${JSON.stringify(DARK_QUERY)}).matches);d.dataset.mode=l?"light":"dark";d.dataset.style=a.style==="plain"?"plain":"colorful";d.style.colorScheme=l?"light":"dark";var c=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_CACHE_KEY)})||"null");if(c&&c.l===l&&c.p===(a.style==="plain")){for(var k in c.v)d.style.setProperty(k,c.v[k]);}}catch(e){}})();`;
