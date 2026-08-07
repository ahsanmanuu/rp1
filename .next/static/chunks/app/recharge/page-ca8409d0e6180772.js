(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[514],{5940:(e,t,r)=>{Promise.resolve().then(r.bind(r,78018))},15530:(e,t,r)=>{"use strict";let a,o;r.d(t,{Toaster:()=>er,Ay:()=>ea,oR:()=>z});var n,i=r(12115);let s={data:""},l=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,c=/\/\*[^]*?\*\/|  +/g,u=/\n+/g,d=(e,t)=>{let r="",a="",o="";for(let n in e){let i=e[n];"@"==n[0]?"i"==n[1]?r=n+" "+i+";":a+="f"==n[1]?d(i,n):n+"{"+d(i,"k"==n[1]?"":t)+"}":"object"==typeof i?a+=d(i,t?t.replace(/([^,])+/g,e=>n.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,t=>/&/.test(t)?t.replace(/&/g,e):e?e+" "+t:t)):n):null!=i&&(n=/^--/.test(n)?n:n.replace(/[A-Z]/g,"-$&").toLowerCase(),o+=d.p?d.p(n,i):n+":"+i+";")}return r+(t&&o?t+"{"+o+"}":o)+a},p={},m=e=>{if("object"==typeof e){let t="";for(let r in e)t+=r+m(e[r]);return t}return e};function f(e){let t,r,a=this||{},o=e.call?e(a.p):e;return((e,t,r,a,o)=>{var n;let i=m(e),s=p[i]||(p[i]=(e=>{let t=0,r=11;for(;t<e.length;)r=101*r+e.charCodeAt(t++)>>>0;return"go"+r})(i));if(!p[s]){let t=i!==e?e:(e=>{let t,r,a=[{}];for(;t=l.exec(e.replace(c,""));)t[4]?a.shift():t[3]?(r=t[3].replace(u," ").trim(),a.unshift(a[0][r]=a[0][r]||{})):a[0][t[1]]=t[2].replace(u," ").trim();return a[0]})(e);p[s]=d(o?{["@keyframes "+s]:t}:t,r?"":"."+s)}let f=r&&p.g?p.g:null;return r&&(p.g=p[s]),n=p[s],f?t.data=t.data.replace(f,n):-1===t.data.indexOf(n)&&(t.data=a?n+t.data:t.data+n),s})(o.unshift?o.raw?(t=[].slice.call(arguments,1),r=a.p,o.reduce((e,a,o)=>{let n=t[o];if(n&&n.call){let e=n(r),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;n=t?"."+t:e&&"object"==typeof e?e.props?"":d(e,""):!1===e?"":e}return e+a+(null==n?"":n)},"")):o.reduce((e,t)=>Object.assign(e,t&&t.call?t(a.p):t),{}):o,(e=>{if("object"==typeof window){let t=(e?e.querySelector("#_goober"):window._goober)||Object.assign(document.createElement("style"),{innerHTML:" ",id:"_goober"});return t.nonce=window.__nonce__,t.parentNode||(e||document.head).appendChild(t),t.firstChild}return e||s})(a.target),a.g,a.o,a.k)}f.bind({g:1});let h,g,y,v=f.bind({k:1});function b(e,t){let r=this||{};return function(){let a=arguments;function o(n,i){let s=Object.assign({},n),l=s.className||o.className;r.p=Object.assign({theme:g&&g()},s),r.o=/ *go\d+/.test(l),s.className=f.apply(r,a)+(l?" "+l:""),t&&(s.ref=i);let c=e;return e[0]&&(c=s.as||e,delete s.as),y&&c[0]&&y(s),h(c,s)}return t?t(o):o}}var x=(e,t)=>"function"==typeof e?e(t):e,w=(a=0,()=>(++a).toString()),k=()=>{if(void 0===o&&"u">typeof window){let e=matchMedia("(prefers-reduced-motion: reduce)");o=!e||e.matches}return o},S="default",P=(e,t)=>{let{toastLimit:r}=e.settings;switch(t.type){case 0:return{...e,toasts:[t.toast,...e.toasts].slice(0,r)};case 1:return{...e,toasts:e.toasts.map(e=>e.id===t.toast.id?{...e,...t.toast}:e)};case 2:let{toast:a}=t;return P(e,{type:+!!e.toasts.find(e=>e.id===a.id),toast:a});case 3:let{toastId:o}=t;return{...e,toasts:e.toasts.map(e=>e.id===o||void 0===o?{...e,dismissed:!0,visible:!1}:e)};case 4:return void 0===t.toastId?{...e,toasts:[]}:{...e,toasts:e.toasts.filter(e=>e.id!==t.toastId)};case 5:return{...e,pausedAt:t.time};case 6:let n=t.time-(e.pausedAt||0);return{...e,pausedAt:void 0,toasts:e.toasts.map(e=>({...e,pauseDuration:e.pauseDuration+n}))}}},E=[],j={toasts:[],pausedAt:void 0,settings:{toastLimit:20}},C={},T=function(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:S;C[t]=P(C[t]||j,e),E.forEach(e=>{let[r,a]=e;r===t&&a(C[t])})},O=e=>Object.keys(C).forEach(t=>T(e,t)),I=function(){let e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:S;return t=>{T(t,e)}},N={blank:4e3,error:4e3,success:2e3,loading:1/0,custom:4e3},$=function(){let e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:S,[r,a]=(0,i.useState)(C[t]||j),o=(0,i.useRef)(C[t]);(0,i.useEffect)(()=>(o.current!==C[t]&&a(C[t]),E.push([t,a]),()=>{let e=E.findIndex(e=>{let[r]=e;return r===t});e>-1&&E.splice(e,1)}),[t]);let n=r.toasts.map(t=>{var r,a,o;return{...e,...e[t.type],...t,removeDelay:t.removeDelay||(null==(r=e[t.type])?void 0:r.removeDelay)||(null==e?void 0:e.removeDelay),duration:t.duration||(null==(a=e[t.type])?void 0:a.duration)||(null==e?void 0:e.duration)||N[t.type],style:{...e.style,...null==(o=e[t.type])?void 0:o.style,...t.style}}});return{...r,toasts:n}},A=function(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"blank",r=arguments.length>2?arguments[2]:void 0;return{createdAt:Date.now(),visible:!0,dismissed:!1,type:t,ariaProps:{role:"status","aria-live":"polite"},message:e,pauseDuration:0,...r,id:(null==r?void 0:r.id)||w()}},_=e=>(t,r)=>{let a,o=A(t,e,r);return I(o.toasterId||(a=o.id,Object.keys(C).find(e=>C[e].toasts.some(e=>e.id===a))))({type:2,toast:o}),o.id},z=(e,t)=>_("blank")(e,t);z.error=_("error"),z.success=_("success"),z.loading=_("loading"),z.custom=_("custom"),z.dismiss=(e,t)=>{let r={type:3,toastId:e};t?I(t)(r):O(r)},z.dismissAll=e=>z.dismiss(void 0,e),z.remove=(e,t)=>{let r={type:4,toastId:e};t?I(t)(r):O(r)},z.removeAll=e=>z.remove(void 0,e),z.promise=(e,t,r)=>{let a=z.loading(t.loading,{...r,...null==r?void 0:r.loading});return"function"==typeof e&&(e=e()),e.then(e=>{let o=t.success?x(t.success,e):void 0;return o?z.success(o,{id:a,...r,...null==r?void 0:r.success}):z.dismiss(a),e}).catch(e=>{let o=t.error?x(t.error,e):void 0;o?z.error(o,{id:a,...r,...null==r?void 0:r.error}):z.dismiss(a)}),e};var D=function(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"default",{toasts:r,pausedAt:a}=$(e,t),o=(0,i.useRef)(new Map).current,n=(0,i.useCallback)(function(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:1e3;if(o.has(e))return;let r=setTimeout(()=>{o.delete(e),s({type:4,toastId:e})},t);o.set(e,r)},[]);(0,i.useEffect)(()=>{if(a)return;let e=Date.now(),o=r.map(r=>{if(r.duration===1/0)return;let a=(r.duration||0)+r.pauseDuration-(e-r.createdAt);if(a<0){r.visible&&z.dismiss(r.id);return}return setTimeout(()=>z.dismiss(r.id,t),a)});return()=>{o.forEach(e=>e&&clearTimeout(e))}},[r,a,t]);let s=(0,i.useCallback)(I(t),[t]),l=(0,i.useCallback)(()=>{s({type:5,time:Date.now()})},[s]),c=(0,i.useCallback)((e,t)=>{s({type:1,toast:{id:e,height:t}})},[s]),u=(0,i.useCallback)(()=>{a&&s({type:6,time:Date.now()})},[a,s]),d=(0,i.useCallback)((e,t)=>{let{reverseOrder:a=!1,gutter:o=8,defaultPosition:n}=t||{},i=r.filter(t=>(t.position||n)===(e.position||n)&&t.height),s=i.findIndex(t=>t.id===e.id),l=i.filter((e,t)=>t<s&&e.visible).length;return i.filter(e=>e.visible).slice(...a?[l+1]:[0,l]).reduce((e,t)=>e+(t.height||0)+o,0)},[r]);return(0,i.useEffect)(()=>{r.forEach(e=>{if(e.dismissed)n(e.id,e.removeDelay);else{let t=o.get(e.id);t&&(clearTimeout(t),o.delete(e.id))}})},[r,n]),{toasts:r,handlers:{updateHeight:c,startPause:l,endPause:u,calculateOffset:d}}},R=v`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,M=v`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,B=v`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,J=b("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${R} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${M} 0.15s ease-out forwards;
    animation-delay: 150ms;
    position: absolute;
    border-radius: 3px;
    opacity: 0;
    background: ${e=>e.secondary||"#fff"};
    bottom: 9px;
    left: 4px;
    height: 2px;
    width: 12px;
  }

  &:before {
    animation: ${B} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,L=v`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,F=b("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${e=>e.secondary||"#e0e0e0"};
  border-right-color: ${e=>e.primary||"#616161"};
  animation: ${L} 1s linear infinite;
`,W=v`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,G=v`
0% {
	height: 0;
	width: 0;
	opacity: 0;
}
40% {
  height: 0;
	width: 6px;
	opacity: 1;
}
100% {
  opacity: 1;
  height: 10px;
}`,H=b("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${W} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${G} 0.2s ease-out forwards;
    opacity: 0;
    animation-delay: 200ms;
    position: absolute;
    border-right: 2px solid;
    border-bottom: 2px solid;
    border-color: ${e=>e.secondary||"#fff"};
    bottom: 6px;
    left: 6px;
    height: 10px;
    width: 6px;
  }
`,U=b("div")`
  position: absolute;
`,q=b("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,Y=v`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,V=b("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${Y} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,X=e=>{let{toast:t}=e,{icon:r,type:a,iconTheme:o}=t;return void 0!==r?"string"==typeof r?i.createElement(V,null,r):r:"blank"===a?null:i.createElement(q,null,i.createElement(F,{...o}),"loading"!==a&&i.createElement(U,null,"error"===a?i.createElement(J,{...o}):i.createElement(H,{...o})))},Z=b("div")`
  display: flex;
  align-items: center;
  background: #fff;
  color: #363636;
  line-height: 1.3;
  will-change: transform;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1), 0 3px 3px rgba(0, 0, 0, 0.05);
  max-width: 350px;
  pointer-events: auto;
  padding: 8px 10px;
  border-radius: 8px;
`,K=b("div")`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`,Q=i.memo(e=>{let{toast:t,position:r,style:a,children:o}=e,n=t.height?((e,t)=>{let r=e.includes("top")?1:-1,[a,o]=k()?["0%{opacity:0;} 100%{opacity:1;}","0%{opacity:1;} 100%{opacity:0;}"]:[`
0% {transform: translate3d(0,${-200*r}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${-150*r}%,-1px) scale(.6); opacity:0;}
`];return{animation:t?`${v(a)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${v(o)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}})(t.position||r||"top-center",t.visible):{opacity:0},s=i.createElement(X,{toast:t}),l=i.createElement(K,{...t.ariaProps},x(t.message,t));return i.createElement(Z,{className:t.className,style:{...n,...a,...t.style}},"function"==typeof o?o({icon:s,message:l}):i.createElement(i.Fragment,null,s,l))});n=i.createElement,d.p=void 0,h=n,g=void 0,y=void 0;var ee=e=>{let{id:t,className:r,style:a,onHeightUpdate:o,children:n}=e,s=i.useCallback(e=>{if(e){let r=()=>{o(t,e.getBoundingClientRect().height)};r(),new MutationObserver(r).observe(e,{subtree:!0,childList:!0,characterData:!0})}},[t,o]);return i.createElement("div",{ref:s,className:r,style:a},n)},et=f`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`,er=e=>{let{reverseOrder:t,position:r="top-center",toastOptions:a,gutter:o,children:n,toasterId:s,containerStyle:l,containerClassName:c}=e,{toasts:u,handlers:d}=D(a,s);return i.createElement("div",{"data-rht-toaster":s||"",style:{position:"fixed",zIndex:9999,top:16,left:16,right:16,bottom:16,pointerEvents:"none",...l},className:c,onMouseEnter:d.startPause,onMouseLeave:d.endPause},u.map(e=>{let a,s,l=e.position||r,c=d.calculateOffset(e,{reverseOrder:t,gutter:o,defaultPosition:r}),u=(a=l.includes("top"),s=l.includes("center")?{justifyContent:"center"}:l.includes("right")?{justifyContent:"flex-end"}:{},{left:0,right:0,display:"flex",position:"absolute",transition:k()?void 0:"all 230ms cubic-bezier(.21,1.02,.73,1)",transform:`translateY(${c*(a?1:-1)}px)`,...a?{top:0}:{bottom:0},...s});return i.createElement(ee,{id:e.id,key:e.id,onHeightUpdate:d.updateHeight,className:e.visible?et:"",style:u},"custom"===e.type?x(e.message,e):n?n(e):i.createElement(Q,{toast:e,position:l}))}))},ea=z},73321:(e,t,r)=>{"use strict";var a=r(74645);r.o(a,"useParams")&&r.d(t,{useParams:function(){return a.useParams}}),r.o(a,"usePathname")&&r.d(t,{usePathname:function(){return a.usePathname}}),r.o(a,"useRouter")&&r.d(t,{useRouter:function(){return a.useRouter}}),r.o(a,"useSearchParams")&&r.d(t,{useSearchParams:function(){return a.useSearchParams}})},73804:()=>{},78018:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>u});var a=r(95155);r(73804);var o=r(99886),n=r(12115),i=r(98500),s=r.n(i),l=r(15530);let c=[{id:"bronze",name:"Bronze",points:50,price:5,description:"Perfect for single project"},{id:"silver",name:"Silver",points:200,price:15,description:"Best for standard users",popular:!0},{id:"gold",name:"Gold",points:1e3,price:50,description:"For professional researchers"}];function u(){let{data:e,update:t}=(0,o.wV)(),[r,i]=(0,n.useState)(null),u=async e=>{i(e);let r=l.Ay.loading("Processing payment...");try{let a=await fetch("/api/points/recharge",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({planId:e})}),o=await a.json();if(!a.ok)throw Error(o.error);await t(),l.Ay.success(`Success! Added ${o.addedPoints} points to your account.`,{id:r})}catch(e){l.Ay.error("Purchase failed: "+e.message,{id:r})}finally{i(null)}};return(0,a.jsxs)("div",{className:"container",style:{padding:"4rem 1.5rem",maxWidth:"1000px"},children:[(0,a.jsxs)("div",{style:{textAlign:"center",marginBottom:"3rem"},children:[(0,a.jsx)("h1",{style:{fontSize:"2.5rem",fontWeight:800,marginBottom:"1rem"},children:"Recharge Your Points"}),(0,a.jsxs)("p",{style:{color:"var(--text-secondary)",fontSize:"1.1rem"},children:["Your current balance: ",(0,a.jsxs)("span",{style:{color:"var(--accent-primary)",fontWeight:700},children:[e?.user?.points??0," Points"]})]})]}),(0,a.jsx)("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:"2rem"},children:c.map(e=>(0,a.jsxs)("div",{className:`card glass ${e.popular?"popular-plan":""}`,style:{display:"flex",flexDirection:"column",padding:"2.5rem",position:"relative",border:e.popular?"2px solid var(--accent-primary)":"1px solid var(--border)",transform:e.popular?"scale(1.05)":"none",zIndex:+!!e.popular},children:[e.popular&&(0,a.jsx)("div",{style:{position:"absolute",top:"-12px",left:"50%",transform:"translateX(-50%)",background:"var(--accent-primary)",color:"white",padding:"0.25rem 1rem",borderRadius:"20px",fontSize:"0.75rem",fontWeight:700,textTransform:"uppercase"},children:"Most Popular"}),(0,a.jsx)("h3",{style:{fontSize:"1.5rem",fontWeight:700,marginBottom:"0.5rem"},children:e.name}),(0,a.jsx)("p",{style:{color:"var(--text-secondary)",fontSize:"0.9rem",marginBottom:"1.5rem",flex:1},children:e.description}),(0,a.jsxs)("div",{style:{marginBottom:"2rem"},children:[(0,a.jsxs)("div",{style:{fontSize:"3rem",fontWeight:800,color:"var(--text-primary)"},children:["$",e.price]}),(0,a.jsxs)("div",{style:{color:"var(--accent-primary)",fontWeight:600},children:[e.points," Points"]})]}),(0,a.jsx)("button",{className:`btn ${e.popular?"btn-primary":"btn-secondary"}`,style:{width:"100%",padding:"1rem"},onClick:()=>u(e.id),disabled:!!r,children:r===e.id?"Processing...":"Buy Now"})]},e.id))}),(0,a.jsx)("div",{style:{marginTop:"4rem",textAlign:"center"},children:(0,a.jsxs)("p",{style:{color:"var(--text-secondary)",fontSize:"0.9rem"},children:["Secure payment processing. Points are added instantly to your account.",(0,a.jsx)("br",{}),"Need a custom plan? ",(0,a.jsx)(s(),{href:"/contact-us",style:{color:"var(--accent-primary)"},children:"Contact Support"})]})})]})}},99886:(e,t,r)=>{"use strict";r.d(t,{CI:()=>u,CP:()=>l,Jv:()=>d,wV:()=>c});var a=r(95155),o=r(12115),n=r(73321),i=r(32576);let s=(0,o.createContext)(null);function l(e){let{children:t,refetchInterval:r=30,refetchOnWindowFocus:n=!1}=e,[l,c]=(0,o.useState)(null),[u,d]=(0,o.useState)("loading"),p=(0,o.useRef)(!1),m=(0,o.useRef)(null),f=(0,o.useRef)("loading"),h=(0,o.useRef)(0),g=(0,o.useCallback)(async e=>{if(void 0!==e)return void(e?(c(e),d("authenticated"),f.current="authenticated",m.current=e.token||null,h.current=0,e.token&&localStorage.setItem("auth-token",e.token)):(c(null),d("unauthenticated"),f.current="unauthenticated",m.current=null,localStorage.removeItem("auth-token")));if(!p.current){p.current=!0;try{let e=await fetch(`/api/auth/pb-session?_=${Date.now()}`,{signal:AbortSignal.timeout(3e4),headers:{"Cache-Control":"no-cache, no-store, must-revalidate",Pragma:"no-cache"}});if(e.ok){let t=await e.json();h.current=0,t.user?(c(e=>e&&JSON.stringify(e)===JSON.stringify(t)?e:t),d("authenticated"),f.current="authenticated",m.current=t.token||null,t.token&&localStorage.setItem("auth-token",t.token)):(c(null),d("unauthenticated"),f.current="unauthenticated",m.current=null,localStorage.removeItem("auth-token"))}else 401===e.status?(c(null),d("unauthenticated"),f.current="unauthenticated",m.current=null,localStorage.removeItem("auth-token")):(d(e=>"loading"===e?"unauthenticated":e),"loading"===f.current&&(f.current="unauthenticated"))}catch(r){let e=r?.name==="TimeoutError"||r?.name==="AbortError",t=e?"Request timed out":r?.message||String(r);if("loading"===f.current&&h.current<3){h.current++;let e=Math.min(3e3*h.current,15e3);p.current=!1,setTimeout(g,e);return}"loading"===f.current||"authenticated"===f.current||e||console.warn("[PB Session Provider] Fetch failed with network error:",t),d(e=>"loading"===e?"unauthenticated":e)}finally{p.current=!1}}},[]);return(0,o.useEffect)(()=>{g()},[g]),(0,o.useEffect)(()=>{let e=setInterval(g,1e3*r);return()=>clearInterval(e)},[r,g]),(0,o.useEffect)(()=>{if(!n)return;let e=()=>g();return window.addEventListener("focus",e),()=>window.removeEventListener("focus",e)},[n,g]),(0,o.useEffect)(()=>{if("authenticated"!==u||!m.current)return;let e=!0,t=m.current,r=(0,i.Pd)("user_sessions","*",r=>{try{if(!e)return;"delete"===r.action&&r.record?.sessionToken===t&&(c(null),d("unauthenticated"),m.current=null,fetch("/api/auth/pb-logout",{method:"POST",signal:AbortSignal.timeout(1e4)}).catch(()=>{}))}catch(e){console.warn("[PB Session Provider] Subscription callback error:",e)}},{tokenProvider:()=>localStorage.getItem("auth-token")});return()=>{e=!1,r()}},[u]),(0,a.jsx)(s.Provider,{value:{data:l,status:u,update:g},children:t})}function c(e){let t=(0,o.useContext)(s),r=(0,n.useRouter)();if(!t)throw Error("useSession must be used within a SessionProvider");return(0,o.useEffect)(()=>{e?.required&&"unauthenticated"===t.status&&(e.onUnauthenticated?e.onUnauthenticated():r.push("/login"))},[t.status,e,r]),t}async function u(e){window.__latexy_signOutInProgress=!0;let t="";{let e=document.cookie.match(/(?:^|;\s*)pb_token=([^;]*)/);e&&(t=e[1])}try{await fetch("/api/auth/pb-logout",{method:"POST",headers:{"Content-Type":"application/json","Cache-Control":"no-cache, no-store, must-revalidate"},body:JSON.stringify({token:t}),cache:"no-store",signal:AbortSignal.timeout(1e4)})}catch(e){console.error("[signOut] Error calling pb-logout API:",e)}finally{try{localStorage.removeItem("auth-token"),sessionStorage.clear(),document.cookie="pb_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0",document.cookie="admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0",document.cookie="next-auth.session-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0",document.cookie="__Secure-next-auth.session-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0"}catch{}window.location.href=e?.callbackUrl||"/login"}}function d(){window.location.href="/login"}}},e=>{e.O(0,[1141,8500,5216,7814,8441,3794,7358],()=>e(e.s=5940)),_N_E=e.O()}]);