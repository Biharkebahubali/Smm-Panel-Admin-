/* BIHARI SMM PRO — secure server-side login */
(function(){
  'use strict';
  let failures=0, lockedUntil=0, busy=false;
  const api='/api';
  window.togglePasswordVisibility=function(){
    const input=document.getElementById('adminPassword');
    const icon=document.querySelector('.password-toggle i');
    if(!input)return;
    const visible=input.type==='text'; input.type=visible?'password':'text';
    if(icon)icon.className=visible?'fas fa-eye':'fas fa-eye-slash';
  };
  function setError(msg){
    const e=document.getElementById('loginError'); if(!e)return;
    e.style.display='block'; e.innerHTML='<i class="fas fa-circle-exclamation"></i> '+msg;
    setTimeout(()=>{e.style.display='none'},3000);
  }
  window.login=async function(){
    if(busy)return false;
    const now=Date.now(); if(now<lockedUntil){setError('Too many attempts. Please wait.');return false;}
    const input=document.getElementById('adminPassword'), button=document.getElementById('loginButton');
    const password=String(input?.value||''); if(!password){setError('Enter your admin password');return false;}
    busy=true; if(button){button.disabled=true;button.innerHTML='<i class="fas fa-spinner fa-spin"></i> Signing in...';}
    try{
      const r=await fetch(api+'?action=login',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},credentials:'same-origin',body:JSON.stringify({password})});
      const data=await r.json().catch(()=>({}));
      if(!r.ok || !data.success) throw new Error(data.error||data.message||'Invalid password');
      failures=0;
      try{localStorage.setItem('bihari_admin_session','1')}catch(_){ }
      location.replace('dashboard.html'); return true;
    }catch(e){
      failures++; if(failures>=5){lockedUntil=Date.now()+15*60*1000;failures=0;setError('Too many failed attempts. Try again in 15 minutes.');}
      else setError(e.message||'Login failed');
      if(input){input.value='';input.focus();}
      if(button){button.classList.add('shake');setTimeout(()=>button.classList.remove('shake'),400);}
      return false;
    }finally{
      busy=false; if(button){button.disabled=false;button.innerHTML='<i class="fas fa-right-to-bracket"></i> Sign in to dashboard';}
    }
  };
  document.addEventListener('DOMContentLoaded',async function(){
    const pass=document.getElementById('adminPassword'); if(pass)pass.addEventListener('keydown',e=>{if(e.key==='Enter')window.login();});
    try{
      const r=await fetch(api+'?action=session',{credentials:'same-origin',headers:{Accept:'application/json'}});
      const d=await r.json(); if(d.authenticated){try{localStorage.setItem('bihari_admin_session','1')}catch(_){};location.replace('dashboard.html');}
    }catch(_){ }
    const v=document.getElementById('loginVersion'); if(v)v.textContent='v20.1';
    const toggle=document.querySelector('.password-toggle');
    if(toggle && !toggle.dataset.bound){toggle.dataset.bound='1';toggle.addEventListener('click',function(e){e.preventDefault();window.togglePasswordVisibility();});}
    const button=document.getElementById('loginButton');
    if(button && !button.dataset.bound){button.dataset.bound='1';button.addEventListener('click',function(e){e.preventDefault();window.login();});}
  });
})();
