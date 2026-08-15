(function(){function e(e){return e}var t=`data-tabai-ownership-processed`,n=[{resourceType:`chat`,rowKeyPrefix:`chat:`,hrefSegment:`chat`,hrefPattern:/\/chat\/([^/?#]+)/},{resourceType:`cowork`,rowKeyPrefix:`cowork:`,hrefSegment:`cowork`,hrefPattern:/\/cowork\/([^/?#]+)/}],r=n.map(e=>e.resourceType),i=n.map(e=>`a[href*="/${e.hrefSegment}/"]`).join(`, `);function a(e){let t=e?.getAttribute(`href`);if(!t)return null;for(let e of n){let n=e.hrefPattern.exec(t)?.[1];if(n)return{resourceType:e.resourceType,resourceId:n}}return null}function o(e){if(!e)return null;for(let t of n)if(e.startsWith(t.rowKeyPrefix)){let n=e.slice(t.rowKeyPrefix.length);return n?{resourceType:t.resourceType,resourceId:n}:null}return null}function s(e){let n=[],r=e.querySelectorAll(`[data-row]:not([${t}])`);for(let e of r){let r=e.querySelector(`[data-row-main-button]`);if(!r)continue;let i=o(e.closest(`[data-row-key]`)?.getAttribute(`data-row-key`)??null)??a(r),s=e.querySelector(`[data-row-action]`);if(!i||!s)continue;let c=r instanceof HTMLElement?e=>r.append(e):e=>s.before(e);e.setAttribute(t,`1`),n.push({...i,mount:c})}return n}function c(e){let n=[],r=e.querySelectorAll(`table[data-cds="Table"] tr[data-hoverable]:not([${t}])`);for(let e of r){let r=e.querySelector(i),o=a(r),s=e.querySelector(`button[aria-haspopup="menu"]`);if(!o||!s)continue;let c=r?.nextElementSibling?.firstElementChild,l=c instanceof HTMLElement?e=>c.append(e):e=>s.before(e);e.setAttribute(t,`1`),n.push({...o,mount:l})}return n}var l=`Solicitar acesso`,u=`Solicitando…`,d=`Solicitado`,f=`Erro — tentar novamente`,p=`Acesso concedido`,m=`🔒`,h=`✅`,g=`data-tabai-request-ownership`,_=`data-tabai-ownership-badge`,v=`data-tabai-force-label`,y=`tabai-icon`,b=`tabai-label`,x=`tabai-ownership-styles`;function S(){if(document.getElementById(x))return;let e=document.createElement(`style`);e.id=x,e.textContent=`
    [${g}], [${_}] {
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
    [${g}] {
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid rgba(0, 0, 0, 0.2);
      background-color: #ffffff;
      color: #1a1a1a;
    }
    [${g}]:hover:not(:disabled) {
      background-color: #f2f2f2;
    }
    [${g}]:disabled {
      cursor: default;
      opacity: 0.7;
    }
    [${_}] {
      padding: 2px 8px;
      border-radius: 999px;
      background-color: #e6f4ea;
      color: #1e7e34;
      font-weight: 500;
    }
    @media (prefers-color-scheme: dark) {
      [${g}] {
        border-color: rgba(255, 255, 255, 0.25);
        background-color: #2a2a2a;
        color: #f2f2f2;
      }
      [${g}]:hover:not(:disabled) {
        background-color: #3a3a3a;
      }
      [${_}] {
        background-color: rgba(46, 160, 67, 0.25);
        color: #6fdd8b;
      }
    }

    [${g}] .${b},
    [${_}] .${b} {
      display: none;
    }
    [data-row]:hover [${g}] .${y},
    [data-row]:hover [${_}] .${y},
    tr[data-hoverable]:hover [${g}] .${y},
    tr[data-hoverable]:hover [${_}] .${y},
    [${g}]:focus .${y},
    [${_}]:focus .${y} {
      display: none;
    }
    [data-row]:hover [${g}] .${b},
    [data-row]:hover [${_}] .${b},
    tr[data-hoverable]:hover [${g}] .${b},
    tr[data-hoverable]:hover [${_}] .${b},
    [${g}]:focus .${b},
    [${_}]:focus .${b} {
      display: inline;
    }
    [${g}][${v}] .${y} {
      display: none;
    }
    [${g}][${v}] .${b} {
      display: inline;
    }
  `,document.head.append(e)}function C(e,t){let n=document.createElement(`span`);n.className=y,n.textContent=e,n.setAttribute(`aria-hidden`,`true`);let r=document.createElement(`span`);return r.className=b,r.textContent=t,{icon:n,label:r}}function w(e,t,n,r){t.textContent=n,e.setAttribute(`aria-label`,n),r?e.setAttribute(v,`1`):e.removeAttribute(v)}function T(e,t){S();let n=document.createElement(`button`);n.type=`button`,n.setAttribute(g,`1`);let{icon:r,label:i}=C(m,l);return n.append(r,i),w(n,i,l,!1),n.addEventListener(`click`,r=>{r.preventDefault(),r.stopPropagation(),!n.disabled&&(n.disabled=!0,w(n,i,u,!0),t(e).then(e=>{w(n,i,e?d:f,!0),n.disabled=e}).catch(()=>{w(n,i,f,!0),n.disabled=!1}))}),n}function E(){S();let e=document.createElement(`span`);e.setAttribute(_,`1`),e.setAttribute(`aria-label`,p);let{icon:t,label:n}=C(h,p);return e.append(t,n),e}function D(e){return e.hasAttribute(_)}function O(e,t){e.mount(t)}var k=`claude`,A=9e4,j=new Map(r.map(e=>[e,new Set])),M=new Map;function N(e){return`${e.resourceType}:${e.resourceId}`}function P(e){return j.get(e.resourceType)?.has(e.resourceId)??!1}function F(e){let t={type:`requestOwnership`,source:k,resourceType:e.resourceType,resourceId:e.resourceId};return chrome.runtime.sendMessage(t).then(e=>e?.ok??!1).catch(e=>(console.error(`[claude-tracker] requestOwnership sendMessage error`,e),!1))}function I(e){let t={type:`listOwnership`,source:k,resourceType:e};return chrome.runtime.sendMessage(t).then(e=>e?.resourceIds??null).catch(e=>(console.error(`[claude-tracker] listOwnership sendMessage error`,e),null))}function L(e){return P(e)?E():T(e,F)}function R(e){for(let t of e){let e=L(t);O(t,e),M.set(N(t),{element:e,resource:t})}}function z(){for(let[e,t]of M){if(!P(t.resource)||D(t.element))continue;let n=E();t.element.replaceWith(n),M.set(e,{element:n,resource:t.resource})}}async function B(){for(let e of r){let t=await I(e);if(!t)continue;let n=j.get(e);if(n){n.clear();for(let e of t)n.add(e)}}z()}function V(){R(s(document)),R(c(document))}var H=e({matches:[`*://claude.ai/*`],main(e){V(),B().catch(e=>console.error(`[claude-tracker] refreshOwnedIds error`,e)),e.setInterval(()=>{B().catch(e=>console.error(`[claude-tracker] refreshOwnedIds error`,e))},A);let t=!1,n=new MutationObserver(()=>{t||(t=!0,e.requestIdleCallback(()=>{t=!1,V()}))});n.observe(document.body,{childList:!0,subtree:!0}),e.onInvalidated(()=>n.disconnect()),e.addEventListener(window,`wxt:locationchange`,()=>V())}}),U={debug:(...e)=>([...e],void 0),log:(...e)=>([...e],void 0),warn:(...e)=>([...e],void 0),error:(...e)=>([...e],void 0)},W=globalThis.browser?.runtime?.id?globalThis.browser:globalThis.chrome,G=class e extends Event{static EVENT_NAME=K(`wxt:locationchange`);constructor(t,n){super(e.EVENT_NAME,{}),this.newUrl=t,this.oldUrl=n}};function K(e){return`${W?.runtime?.id}:request-ownership:${e}`}var q=typeof globalThis.navigation?.addEventListener==`function`;function J(e){let t,n=!1;return{run(){n||(n=!0,t=new URL(location.href),q?globalThis.navigation.addEventListener(`navigate`,e=>{let n=new URL(e.destination.url);n.href!==t.href&&(window.dispatchEvent(new G(n,t)),t=n)},{signal:e.signal}):e.setInterval(()=>{let e=new URL(location.href);e.href!==t.href&&(window.dispatchEvent(new G(e,t)),t=e)},1e3))}}}var Y=class e{static SCRIPT_STARTED_MESSAGE_TYPE=K(`wxt:content-script-started`);id;abortController;locationWatcher=J(this);constructor(e,t){this.contentScriptName=e,this.options=t,this.id=Math.random().toString(36).slice(2),this.abortController=new AbortController,this.stopOldScripts(),this.listenForNewerScripts()}get signal(){return this.abortController.signal}abort(e){return this.abortController.abort(e)}get isInvalid(){return W.runtime?.id??this.notifyInvalidated(),this.signal.aborted}get isValid(){return!this.isInvalid}onInvalidated(e){return this.signal.addEventListener(`abort`,e),()=>this.signal.removeEventListener(`abort`,e)}block(){return new Promise(()=>{})}setInterval(e,t){let n=setInterval(()=>{this.isValid&&e()},t);return this.onInvalidated(()=>clearInterval(n)),n}setTimeout(e,t){let n=setTimeout(()=>{this.isValid&&e()},t);return this.onInvalidated(()=>clearTimeout(n)),n}requestAnimationFrame(e){let t=requestAnimationFrame((...t)=>{this.isValid&&e(...t)});return this.onInvalidated(()=>cancelAnimationFrame(t)),t}requestIdleCallback(e,t){let n=requestIdleCallback((...t)=>{this.signal.aborted||e(...t)},t);return this.onInvalidated(()=>cancelIdleCallback(n)),n}addEventListener(e,t,n,r){t===`wxt:locationchange`&&this.isValid&&this.locationWatcher.run(),e.addEventListener?.(t.startsWith(`wxt:`)?K(t):t,n,{...r,signal:this.signal})}notifyInvalidated(){this.abort(`Content script context invalidated`),U.debug(`Content script "${this.contentScriptName}" context invalidated`)}stopOldScripts(){document.dispatchEvent(new CustomEvent(e.SCRIPT_STARTED_MESSAGE_TYPE,{detail:{contentScriptName:this.contentScriptName,messageId:this.id}})),this.options?.noScriptStartedPostMessage||window.postMessage({type:e.SCRIPT_STARTED_MESSAGE_TYPE,contentScriptName:this.contentScriptName,messageId:this.id},`*`)}verifyScriptStartedEvent(e){let t=e.detail?.contentScriptName===this.contentScriptName,n=e.detail?.messageId===this.id;return t&&!n}listenForNewerScripts(){let t=e=>{!(e instanceof CustomEvent)||!this.verifyScriptStartedEvent(e)||this.notifyInvalidated()};document.addEventListener(e.SCRIPT_STARTED_MESSAGE_TYPE,t),this.onInvalidated(()=>document.removeEventListener(e.SCRIPT_STARTED_MESSAGE_TYPE,t))}},X={debug:(...e)=>([...e],void 0),log:(...e)=>([...e],void 0),warn:(...e)=>([...e],void 0),error:(...e)=>([...e],void 0)};return(async()=>{try{let{main:e,...t}=H;return await e(new Y(`request-ownership`,t))}catch(e){throw X.error(`The content script "request-ownership" crashed on startup!`,e),e}})()})();