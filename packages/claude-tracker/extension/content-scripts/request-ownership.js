(function(){function e(e){return e}var t=`data-tabai-ownership-processed`,n=/\/chat\/([^/?#]+)/;function r(e){let t=e?.getAttribute(`href`);return t?n.exec(t)?.[1]??null:null}function i(e){return!e||!e.startsWith(`chat:`)?null:e.slice(5)}function a(e){let n=[],a=e.querySelectorAll(`[data-row]:not([${t}])`);for(let e of a){let a=e.querySelector(`[data-row-main-button]`);if(!a)continue;let o=i(e.closest(`[data-row-key]`)?.getAttribute(`data-row-key`)??null)??r(a),s=e.querySelector(`[data-row-action]`);!o||!s||(e.setAttribute(t,`1`),n.push({resourceId:o,moreOptionsButton:s}))}return n}function o(e){let n=[],i=e.querySelectorAll(`table[data-cds="Table"] tr[data-hoverable]:not([${t}])`);for(let e of i){let i=r(e.querySelector(`a[href*="/chat/"]`)),a=e.querySelector(`button[aria-haspopup="menu"]`);!i||!a||(e.setAttribute(t,`1`),n.push({resourceId:i,moreOptionsButton:a}))}return n}var s=`Erro — tentar novamente`,c=`data-tabai-request-ownership`,l=`data-tabai-ownership-badge`,u=`tabai-ownership-styles`;function d(){if(document.getElementById(u))return;let e=document.createElement(`style`);e.id=u,e.textContent=`
    [${c}], [${l}] {
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
    [${c}] {
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid rgba(0, 0, 0, 0.2);
      background-color: #ffffff;
      color: #1a1a1a;
    }
    [${c}]:hover:not(:disabled) {
      background-color: #f2f2f2;
    }
    [${c}]:disabled {
      cursor: default;
      opacity: 0.7;
    }
    [${l}] {
      padding: 2px 8px;
      border-radius: 999px;
      background-color: #e6f4ea;
      color: #1e7e34;
      font-weight: 500;
    }
    @media (prefers-color-scheme: dark) {
      [${c}] {
        border-color: rgba(255, 255, 255, 0.25);
        background-color: #2a2a2a;
        color: #f2f2f2;
      }
      [${c}]:hover:not(:disabled) {
        background-color: #3a3a3a;
      }
      [${l}] {
        background-color: rgba(46, 160, 67, 0.25);
        color: #6fdd8b;
      }
    }
  `,document.head.append(e)}function f(e,t){d();let n=document.createElement(`button`);return n.type=`button`,n.textContent=`Solicitar acesso`,n.setAttribute(c,`1`),n.addEventListener(`click`,r=>{r.preventDefault(),r.stopPropagation(),!n.disabled&&(n.disabled=!0,n.textContent=`Solicitando…`,t(e).then(e=>{n.textContent=e?`Solicitado`:s,n.disabled=e}).catch(()=>{n.textContent=s,n.disabled=!1}))}),n}function p(){d();let e=document.createElement(`span`);return e.textContent=`Acesso concedido`,e.setAttribute(l,`1`),e}function m(e){return e.hasAttribute(l)}function h(e,t){e.moreOptionsButton.before(t)}var g=`claude`,_=`chat`,v=new Set,y=new Map;function b(e){let t={type:`requestOwnership`,source:g,resourceType:_,resourceId:e};return chrome.runtime.sendMessage(t).then(e=>e?.ok??!1).catch(e=>(console.error(`[claude-tracker] requestOwnership sendMessage error`,e),!1))}function x(){let e={type:`listOwnership`,source:g,resourceType:_};return chrome.runtime.sendMessage(e).then(e=>e?.resourceIds??null).catch(e=>(console.error(`[claude-tracker] listOwnership sendMessage error`,e),null))}function S(e){return v.has(e.resourceId)?p():f(e.resourceId,b)}function C(e){for(let t of e){let e=S(t);h(t,e),y.set(t.resourceId,e)}}function w(){for(let[e,t]of y){if(!v.has(e)||m(t))continue;let n=p();t.replaceWith(n),y.set(e,n)}}async function T(){let e=await x();if(e){v.clear();for(let t of e)v.add(t);w()}}function E(){C(a(document)),C(o(document))}var D=e({matches:[`*://claude.ai/*`],main(e){E(),T().catch(e=>console.error(`[claude-tracker] refreshOwnedIds error`,e)),e.setInterval(()=>{T().catch(e=>console.error(`[claude-tracker] refreshOwnedIds error`,e))},9e4);let t=!1,n=new MutationObserver(()=>{t||(t=!0,e.requestIdleCallback(()=>{t=!1,E()}))});n.observe(document.body,{childList:!0,subtree:!0}),e.onInvalidated(()=>n.disconnect()),e.addEventListener(window,`wxt:locationchange`,()=>E())}}),O={debug:(...e)=>([...e],void 0),log:(...e)=>([...e],void 0),warn:(...e)=>([...e],void 0),error:(...e)=>([...e],void 0)},k=globalThis.browser?.runtime?.id?globalThis.browser:globalThis.chrome,A=class e extends Event{static EVENT_NAME=j(`wxt:locationchange`);constructor(t,n){super(e.EVENT_NAME,{}),this.newUrl=t,this.oldUrl=n}};function j(e){return`${k?.runtime?.id}:request-ownership:${e}`}var M=typeof globalThis.navigation?.addEventListener==`function`;function N(e){let t,n=!1;return{run(){n||(n=!0,t=new URL(location.href),M?globalThis.navigation.addEventListener(`navigate`,e=>{let n=new URL(e.destination.url);n.href!==t.href&&(window.dispatchEvent(new A(n,t)),t=n)},{signal:e.signal}):e.setInterval(()=>{let e=new URL(location.href);e.href!==t.href&&(window.dispatchEvent(new A(e,t)),t=e)},1e3))}}}var P=class e{static SCRIPT_STARTED_MESSAGE_TYPE=j(`wxt:content-script-started`);id;abortController;locationWatcher=N(this);constructor(e,t){this.contentScriptName=e,this.options=t,this.id=Math.random().toString(36).slice(2),this.abortController=new AbortController,this.stopOldScripts(),this.listenForNewerScripts()}get signal(){return this.abortController.signal}abort(e){return this.abortController.abort(e)}get isInvalid(){return k.runtime?.id??this.notifyInvalidated(),this.signal.aborted}get isValid(){return!this.isInvalid}onInvalidated(e){return this.signal.addEventListener(`abort`,e),()=>this.signal.removeEventListener(`abort`,e)}block(){return new Promise(()=>{})}setInterval(e,t){let n=setInterval(()=>{this.isValid&&e()},t);return this.onInvalidated(()=>clearInterval(n)),n}setTimeout(e,t){let n=setTimeout(()=>{this.isValid&&e()},t);return this.onInvalidated(()=>clearTimeout(n)),n}requestAnimationFrame(e){let t=requestAnimationFrame((...t)=>{this.isValid&&e(...t)});return this.onInvalidated(()=>cancelAnimationFrame(t)),t}requestIdleCallback(e,t){let n=requestIdleCallback((...t)=>{this.signal.aborted||e(...t)},t);return this.onInvalidated(()=>cancelIdleCallback(n)),n}addEventListener(e,t,n,r){t===`wxt:locationchange`&&this.isValid&&this.locationWatcher.run(),e.addEventListener?.(t.startsWith(`wxt:`)?j(t):t,n,{...r,signal:this.signal})}notifyInvalidated(){this.abort(`Content script context invalidated`),O.debug(`Content script "${this.contentScriptName}" context invalidated`)}stopOldScripts(){document.dispatchEvent(new CustomEvent(e.SCRIPT_STARTED_MESSAGE_TYPE,{detail:{contentScriptName:this.contentScriptName,messageId:this.id}})),this.options?.noScriptStartedPostMessage||window.postMessage({type:e.SCRIPT_STARTED_MESSAGE_TYPE,contentScriptName:this.contentScriptName,messageId:this.id},`*`)}verifyScriptStartedEvent(e){let t=e.detail?.contentScriptName===this.contentScriptName,n=e.detail?.messageId===this.id;return t&&!n}listenForNewerScripts(){let t=e=>{!(e instanceof CustomEvent)||!this.verifyScriptStartedEvent(e)||this.notifyInvalidated()};document.addEventListener(e.SCRIPT_STARTED_MESSAGE_TYPE,t),this.onInvalidated(()=>document.removeEventListener(e.SCRIPT_STARTED_MESSAGE_TYPE,t))}},F={debug:(...e)=>([...e],void 0),log:(...e)=>([...e],void 0),warn:(...e)=>([...e],void 0),error:(...e)=>([...e],void 0)};return(async()=>{try{let{main:e,...t}=D;return await e(new P(`request-ownership`,t))}catch(e){throw F.error(`The content script "request-ownership" crashed on startup!`,e),e}})()})();