(function(){function e(e){return e}var t=`data-tabai-ownership-processed`,n=/\/chat\/([^/?#]+)/;function r(e){let t=e?.getAttribute(`href`);return t?n.exec(t)?.[1]??null:null}function i(e){return!e||!e.startsWith(`chat:`)?null:e.slice(5)}function a(e){let n=[],a=e.querySelectorAll(`[data-row]:not([${t}])`);for(let e of a){let a=e.querySelector(`[data-row-main-button]`);if(!a)continue;let o=i(e.closest(`[data-row-key]`)?.getAttribute(`data-row-key`)??null)??r(a),s=e.querySelector(`[data-row-action]`);if(!o||!s)continue;let c=a instanceof HTMLElement?e=>a.append(e):e=>s.before(e);e.setAttribute(t,`1`),n.push({resourceId:o,mount:c})}return n}function o(e){let n=[],i=e.querySelectorAll(`table[data-cds="Table"] tr[data-hoverable]:not([${t}])`);for(let e of i){let i=e.querySelector(`a[href*="/chat/"]`),a=r(i),o=e.querySelector(`button[aria-haspopup="menu"]`);if(!a||!o)continue;let s=i?.nextElementSibling?.firstElementChild,c=s instanceof HTMLElement?e=>s.append(e):e=>o.before(e);e.setAttribute(t,`1`),n.push({resourceId:a,mount:c})}return n}var s=`Solicitar acesso`,c=`Erro — tentar novamente`,l=`Acesso concedido`,u=`data-tabai-request-ownership`,d=`data-tabai-ownership-badge`,f=`data-tabai-force-label`,p=`tabai-icon`,m=`tabai-label`,h=`tabai-ownership-styles`;function g(){if(document.getElementById(h))return;let e=document.createElement(`style`);e.id=h,e.textContent=`
    [${u}], [${d}] {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      position: relative;
      z-index: 999999;
      font-family: inherit;
      font-size: 12px;
      line-height: 1;
      white-space: nowrap;
    }
    [${u}] {
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid rgba(0, 0, 0, 0.2);
      background-color: #ffffff;
      color: #1a1a1a;
    }
    [${u}]:hover:not(:disabled) {
      background-color: #f2f2f2;
    }
    [${u}]:disabled {
      cursor: default;
      opacity: 0.7;
    }
    [${d}] {
      padding: 2px 8px;
      border-radius: 999px;
      background-color: #e6f4ea;
      color: #1e7e34;
      font-weight: 500;
    }
    @media (prefers-color-scheme: dark) {
      [${u}] {
        border-color: rgba(255, 255, 255, 0.25);
        background-color: #2a2a2a;
        color: #f2f2f2;
      }
      [${u}]:hover:not(:disabled) {
        background-color: #3a3a3a;
      }
      [${d}] {
        background-color: rgba(46, 160, 67, 0.25);
        color: #6fdd8b;
      }
    }

    [${u}] .${m},
    [${d}] .${m} {
      display: none;
    }
    [data-row]:hover [${u}] .${p},
    [data-row]:hover [${d}] .${p},
    tr[data-hoverable]:hover [${u}] .${p},
    tr[data-hoverable]:hover [${d}] .${p},
    [${u}]:focus .${p},
    [${d}]:focus .${p} {
      display: none;
    }
    [data-row]:hover [${u}] .${m},
    [data-row]:hover [${d}] .${m},
    tr[data-hoverable]:hover [${u}] .${m},
    tr[data-hoverable]:hover [${d}] .${m},
    [${u}]:focus .${m},
    [${d}]:focus .${m} {
      display: inline;
    }
    [${u}][${f}] .${p} {
      display: none;
    }
    [${u}][${f}] .${m} {
      display: inline;
    }
  `,document.head.append(e)}function _(e,t){let n=document.createElement(`span`);n.className=p,n.textContent=e,n.setAttribute(`aria-hidden`,`true`);let r=document.createElement(`span`);return r.className=m,r.textContent=t,{icon:n,label:r}}function v(e,t,n,r){t.textContent=n,e.setAttribute(`aria-label`,n),r?e.setAttribute(f,`1`):e.removeAttribute(f)}function y(e,t){g();let n=document.createElement(`button`);n.type=`button`,n.setAttribute(u,`1`);let{icon:r,label:i}=_(`🔒`,s);return n.append(r,i),v(n,i,s,!1),n.addEventListener(`click`,r=>{r.preventDefault(),r.stopPropagation(),!n.disabled&&(n.disabled=!0,v(n,i,`Solicitando…`,!0),t(e).then(e=>{v(n,i,e?`Solicitado`:c,!0),n.disabled=e}).catch(()=>{v(n,i,c,!0),n.disabled=!1}))}),n}function b(){g();let e=document.createElement(`span`);e.setAttribute(d,`1`),e.setAttribute(`aria-label`,l);let{icon:t,label:n}=_(`✅`,l);return e.append(t,n),e}function x(e){return e.hasAttribute(d)}function S(e,t){e.mount(t)}var C=`claude`,w=`chat`,T=new Set,E=new Map;function D(e){let t={type:`requestOwnership`,source:C,resourceType:w,resourceId:e};return chrome.runtime.sendMessage(t).then(e=>e?.ok??!1).catch(e=>(console.error(`[claude-tracker] requestOwnership sendMessage error`,e),!1))}function O(){let e={type:`listOwnership`,source:C,resourceType:w};return chrome.runtime.sendMessage(e).then(e=>e?.resourceIds??null).catch(e=>(console.error(`[claude-tracker] listOwnership sendMessage error`,e),null))}function k(e){return T.has(e.resourceId)?b():y(e.resourceId,D)}function A(e){for(let t of e){let e=k(t);S(t,e),E.set(t.resourceId,e)}}function j(){for(let[e,t]of E){if(!T.has(e)||x(t))continue;let n=b();t.replaceWith(n),E.set(e,n)}}async function M(){let e=await O();if(e){T.clear();for(let t of e)T.add(t);j()}}function N(){A(a(document)),A(o(document))}var P=e({matches:[`*://claude.ai/*`],main(e){N(),M().catch(e=>console.error(`[claude-tracker] refreshOwnedIds error`,e)),e.setInterval(()=>{M().catch(e=>console.error(`[claude-tracker] refreshOwnedIds error`,e))},9e4);let t=!1,n=new MutationObserver(()=>{t||(t=!0,e.requestIdleCallback(()=>{t=!1,N()}))});n.observe(document.body,{childList:!0,subtree:!0}),e.onInvalidated(()=>n.disconnect()),e.addEventListener(window,`wxt:locationchange`,()=>N())}}),F={debug:(...e)=>([...e],void 0),log:(...e)=>([...e],void 0),warn:(...e)=>([...e],void 0),error:(...e)=>([...e],void 0)},I=globalThis.browser?.runtime?.id?globalThis.browser:globalThis.chrome,L=class e extends Event{static EVENT_NAME=R(`wxt:locationchange`);constructor(t,n){super(e.EVENT_NAME,{}),this.newUrl=t,this.oldUrl=n}};function R(e){return`${I?.runtime?.id}:request-ownership:${e}`}var z=typeof globalThis.navigation?.addEventListener==`function`;function B(e){let t,n=!1;return{run(){n||(n=!0,t=new URL(location.href),z?globalThis.navigation.addEventListener(`navigate`,e=>{let n=new URL(e.destination.url);n.href!==t.href&&(window.dispatchEvent(new L(n,t)),t=n)},{signal:e.signal}):e.setInterval(()=>{let e=new URL(location.href);e.href!==t.href&&(window.dispatchEvent(new L(e,t)),t=e)},1e3))}}}var V=class e{static SCRIPT_STARTED_MESSAGE_TYPE=R(`wxt:content-script-started`);id;abortController;locationWatcher=B(this);constructor(e,t){this.contentScriptName=e,this.options=t,this.id=Math.random().toString(36).slice(2),this.abortController=new AbortController,this.stopOldScripts(),this.listenForNewerScripts()}get signal(){return this.abortController.signal}abort(e){return this.abortController.abort(e)}get isInvalid(){return I.runtime?.id??this.notifyInvalidated(),this.signal.aborted}get isValid(){return!this.isInvalid}onInvalidated(e){return this.signal.addEventListener(`abort`,e),()=>this.signal.removeEventListener(`abort`,e)}block(){return new Promise(()=>{})}setInterval(e,t){let n=setInterval(()=>{this.isValid&&e()},t);return this.onInvalidated(()=>clearInterval(n)),n}setTimeout(e,t){let n=setTimeout(()=>{this.isValid&&e()},t);return this.onInvalidated(()=>clearTimeout(n)),n}requestAnimationFrame(e){let t=requestAnimationFrame((...t)=>{this.isValid&&e(...t)});return this.onInvalidated(()=>cancelAnimationFrame(t)),t}requestIdleCallback(e,t){let n=requestIdleCallback((...t)=>{this.signal.aborted||e(...t)},t);return this.onInvalidated(()=>cancelIdleCallback(n)),n}addEventListener(e,t,n,r){t===`wxt:locationchange`&&this.isValid&&this.locationWatcher.run(),e.addEventListener?.(t.startsWith(`wxt:`)?R(t):t,n,{...r,signal:this.signal})}notifyInvalidated(){this.abort(`Content script context invalidated`),F.debug(`Content script "${this.contentScriptName}" context invalidated`)}stopOldScripts(){document.dispatchEvent(new CustomEvent(e.SCRIPT_STARTED_MESSAGE_TYPE,{detail:{contentScriptName:this.contentScriptName,messageId:this.id}})),this.options?.noScriptStartedPostMessage||window.postMessage({type:e.SCRIPT_STARTED_MESSAGE_TYPE,contentScriptName:this.contentScriptName,messageId:this.id},`*`)}verifyScriptStartedEvent(e){let t=e.detail?.contentScriptName===this.contentScriptName,n=e.detail?.messageId===this.id;return t&&!n}listenForNewerScripts(){let t=e=>{!(e instanceof CustomEvent)||!this.verifyScriptStartedEvent(e)||this.notifyInvalidated()};document.addEventListener(e.SCRIPT_STARTED_MESSAGE_TYPE,t),this.onInvalidated(()=>document.removeEventListener(e.SCRIPT_STARTED_MESSAGE_TYPE,t))}},H={debug:(...e)=>([...e],void 0),log:(...e)=>([...e],void 0),warn:(...e)=>([...e],void 0),error:(...e)=>([...e],void 0)};return(async()=>{try{let{main:e,...t}=P;return await e(new V(`request-ownership`,t))}catch(e){throw H.error(`The content script "request-ownership" crashed on startup!`,e),e}})()})();