
/* Shared input values; old one-key saves remain valid. No listeners or save loop. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;root.PlatdoInput=api;})(typeof window!=='undefined'?window:globalThis,function(){'use strict';
 const list=value=>Array.isArray(value)?value.filter(x=>typeof x==='string'):typeof value==='string'&&value?[value]:[];
 const valid=code=>typeof code==='string'&&/^(Key[A-Z]|Digit[0-9]|Numpad\w+|F([1-9]|1[0-9]|2[0-4])|Space|Tab|Enter|Escape|Backspace|Delete|Insert|Home|End|PageUp|PageDown|CapsLock|NumLock|ScrollLock|Pause|PrintScreen|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|Meta(Left|Right)|Arrow(Up|Down|Left|Right)|Bracket(Left|Right)|Minus|Equal|Semicolon|Quote|Comma|Period|Slash|Backslash|IntlBackslash|Backquote|ContextMenu|Mouse[0-4]|Wheel(Up|Down|Left|Right))$/.test(code);
 const matches=(value,code)=>list(value).includes(code),held=(value,set)=>list(value).some(k=>set.has(k));
 function name(code){return({Mouse0:'Left mouse',Mouse1:'Middle mouse',Mouse2:'Right mouse',Mouse3:'Mouse 4',Mouse4:'Mouse 5',WheelUp:'Scroll up',WheelDown:'Scroll down',WheelLeft:'Scroll left',WheelRight:'Scroll right',Space:'Space',Escape:'Esc'})[code]||String(code||'Unbound').replace(/^Key/,'').replace(/^Digit/,'').replace(/([a-z])([A-Z])/g,'$1 $2');}
 const label=value=>list(value).map(name).join(' / ')||'Unbound';
 function assign(bindings,action,code,options={}){if(!valid(code))return false;const values=list(bindings[action]);if(options.append){if(!values.includes(code))values.push(code);}else if(Number.isInteger(options.index)){values[options.index]=code;}else values.splice(0,values.length,code);bindings[action]=[...new Set(values)];return true;}
 function remove(bindings,action,index){const values=list(bindings[action]);values.splice(index,1);bindings[action]=values;}
 function wheel(event){return Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX<0?'WheelLeft':'WheelRight':event.deltaY<0?'WheelUp':'WheelDown';}
 return{list,valid,matches,held,label,name,assign,remove,wheel};
});

