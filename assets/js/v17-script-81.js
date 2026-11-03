/* Shared account panel. Passwords and SMS codes exist only in the current form. */
(function (root) {
  'use strict';
  function node(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
  function mount(container,initial) {
    const account=root.PlatdoAccount;
    let page=initial,locked=false,disposed=false,identity,unsubscribe,notice='';
    const status=node('p','','pp-account-status');status.setAttribute('role','status');
    function action(label,fn,cls){
      const b=node('button',label,cls);b.type='button';b.onclick=fn;return b;
    }
    async function request(fn,success,next){
      if(locked)return;
      locked=true;let ok=false;
      const controls=[...container.querySelectorAll('button,input')].filter(n=>!n.disabled);
      controls.forEach(n=>n.disabled=true);container.setAttribute('aria-busy','true');status.textContent='Working…';
      try{if(await fn()===false)throw Error('This action could not finish. Check your connection and retry from the main menu.');ok=true;notice=success||'';}catch(e){notice=account.formatError(e);}
      finally{locked=false;container.removeAttribute('aria-busy');controls.forEach(n=>n.disabled=false);}
      if(disposed)return;
      if(ok&&next){page=next;draw();}else{
        status.textContent=notice;
        const redirect=container.querySelector('[data-redirect-signin]');
        if(redirect&&/popup|blocked/i.test(notice))redirect.hidden=false;
      }
    }
    function go(next){if(locked)return;account.clearPhone();notice='';page=next;draw();}
    function draw(){
      if(disposed)return;
      const s=account.getState(),user=s.user;
      identity=user?.uid||'';container.replaceChildren();
      const box=node('div',null,'pp-account-details pp-account-card'),heading=node('h2');container.append(box);box.append(heading);
      const form=node('form',null,'pp-auth-fields'),buttons=node('div',null,'pp-account-actions');
      box.append(form,buttons,status);status.textContent=notice||s.verificationNotice||s.error||'';
      const field=(label,type,name,auto,value='')=>{
        const wrap=node('label',label),input=document.createElement('input');
        input.type=type;input.name=name;input.required=true;input.autocomplete=auto;input.value=value;
        if(name==='nickname')input.maxLength=32;
        wrap.append(input);form.append(wrap);return input;
      };
      const submit=(label,fn,msg,next)=>{const b=node('button',label);b.type='submit';form.append(b);form.onsubmit=e=>{e.preventDefault();request(fn,msg,next);};};
      const link=(label,next)=>buttons.append(action(label,()=>go(next),'pp-secondary'));
      const command=(label,fn,msg,next)=>buttons.append(action(label,()=>request(fn,msg,next)));
      if(page==='account'&&user){
        heading.textContent=user.displayName;box.insertBefore(node('p',user.isAnonymous?'Anonymous account':user.email||'Signed in'),form);
        if(user.photoURL&&/^(https:\/\/|data:image\/)/i.test(user.photoURL)){const img=node('img',null,'pp-avatar pp-avatar-large');img.src=user.photoURL;img.alt='Your profile picture';box.prepend(img);}
        if(!user.isAnonymous){
          const nickname=field('Public player name','text','nickname','nickname',user.displayName);
          submit('Save nickname',()=>account.updateNickname(nickname.value),'Player name updated.','account');
        }else link('Create Account','create');
        command('Load all progress',()=>account.loadAllProgress(),'All available cloud progress is loaded.','account');
        command('Sync now',()=>account.syncNow(),'Sync complete.','account');
        if(user.email&&!user.emailVerified)command('Resend verification email',()=>account.resendVerification(),'Check your email for the verification link.','account');
        const methods=node('section',null,'pp-linked-methods');methods.append(node('h3','Sign-in methods'));
        buttons.append(methods);
        for(const [provider,label] of [['google.com','Google'],['phone','Phone'],['password','Email and password']]){
          if(user.providers.includes(provider)){methods.append(node('p',label+' · Linked'));continue;}
          if(provider==='google.com'){
            methods.append(action('Link Google',()=>request(()=>account.linkGoogle(),'Google linked to this player.','account')));
            const redirect=action('Link Google in this tab',()=>request(()=>account.linkGoogle(true)));
            redirect.dataset.redirectSignin='';redirect.hidden=true;methods.append(redirect);
          }else if(provider==='phone')methods.append(action('Link phone number',()=>go('link-phone')));
          else if(!user.isAnonymous)methods.append(action('Add password login',()=>go('link')));
        }
        const pick=field('Change profile picture','file','picture','off');pick.required=false;pick.accept='image/png,image/jpeg,image/webp,image/gif';pick.onchange=()=>{if(pick.files[0])request(()=>account.updateProfilePicture(pick.files[0]),'Profile picture updated.','account');};
        command('Log Out',()=>account.signOut(),'Logged out.','login');
        if(s.conflicts?.length){
          box.append(node('p','This device and the cloud have different saves for '+s.conflicts.map(c=>c.name||c.id).join(', ')+'. Load all progress to use cloud versions, or keep the device versions. A backup is made first.'));
          command('Keep conflicting device saves',()=>account.keepDeviceConflicts(),'Device versions saved.','account');
        }
        return;
      }
      if(page==='account')page='login';
      const linkingPhone=page==='link-phone'||page==='link-code';
      const titles={login:'Log In',create:'Create Account',reset:'Reset password',link:'Add password login',phone:'Phone sign-in',code:'Verify your number','link-phone':'Link phone number','link-code':'Verify and link your number'};heading.textContent=titles[page]||'Log In';
      if(page==='phone'||page==='link-phone'){
        const phone=field('Phone number with country code','tel','phone','tel');
        form.append(node('p','Verification texts are available in the US and Canada. Google receives the number for verification and abuse prevention. Message and data rates may apply.'));
        const captcha=node('div');form.append(captcha);
        submit('Send verification text',()=>account.sendPhone(phone.value,captcha,linkingPhone),'Enter the code from the text message.',linkingPhone?'link-code':'code');link(linkingPhone?'Back to account':'Back to Log In',linkingPhone?'account':'login');return;
      }
      if(page==='code'||page==='link-code'){
        const code=field('Six-digit code','text','code','one-time-code');code.inputMode='numeric';code.pattern='[0-9]{6}';
        submit(linkingPhone?'Verify and link':'Verify and log in',()=>account.confirmPhone(code.value),linkingPhone?'Phone number linked to this player.':'','account');link('Request another text',linkingPhone?'link-phone':'phone');if(linkingPhone)link('Back to account','account');return;
      }
      const make=page==='create',attach=page==='link',forgot=page==='reset';
      const name=make?field('Player name','text','nickname','nickname'):null;
      const email=field('Email address','email','email','email',attach?user?.email:'');if(attach&&user?.email)email.readOnly=true;
      if(forgot){submit('Send reset email',()=>account.resetPassword(email.value),'If an account can use password login at that address, check its inbox for a reset link.','login');link('Back to Log In','login');return;}
      const password=field('Password','password','password',make||attach?'new-password':'current-password');
      const confirmation=make||attach?field('Confirm password','password','confirm','new-password'):null;
      const show=action('Show password',()=>{const reveal=password.type==='password';for(const p of [password,confirmation].filter(Boolean))p.type=reveal?'text':'password';show.textContent=reveal?'Hide password':'Show password';show.setAttribute('aria-pressed',String(reveal));},'pp-secondary');form.append(show);
      submit(titles[page],async()=>{
        if(confirmation&&password.value!==confirmation.value)throw Error('The passwords do not match.');
        if(make)await account.createAccount(name.value,email.value,password.value);
        else if(attach)await account.linkPassword(email.value,password.value);
        else await account.loginEmail(email.value,password.value);
        password.value='';if(confirmation)confirmation.value='';
      },make?'Account created. Check your email for verification.':attach?'Password login added. Your player ID and saves are unchanged.':'','account');
      if(attach){link('Back to account','account');return;}
      if(make){link('Already have an account? Log In','login');return;}
      link('Forgot password?','reset');link('Create Account','create');
      command('Continue with Google',()=>account.signIn(),'','account');
      const redirect=action('Continue with Google in this tab',()=>request(()=>account.signIn({redirect:true})));
      redirect.dataset.redirectSignin='';redirect.hidden=!/popup|blocked/i.test(s.error||'');buttons.append(redirect);
      link('Continue with phone','phone');command('Continue anonymously',()=>account.anonymous(),'','account');
      box.append(node('p','Game Center sign-in requires a native Apple game.','pp-note'));
    }
    draw();
    unsubscribe=account.subscribe(s=>{if(!locked&&!disposed&&identity!==(s.user?.uid||'')){page=s.user?'account':'login';draw();}});
    return ()=>{disposed=true;unsubscribe();account.clearPhone();};
  }
  root.PlatdoAccountView={mount};
})(window);
