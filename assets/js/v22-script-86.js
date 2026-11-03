/* The selected picture lives with the account's synced City appearance.
   The uploaded picture stays in the account profile when switching sources. */
(function(root){
  'use strict';
  const store=()=>root.Platdo.storage('avatar');
  function read(uid){
    try{const record=JSON.parse(store().get('profilePortrait'));if(record?.uid===uid&&record.mode==='city'&&record.image?.startsWith('data:image/jpeg;base64,'))return record;}catch{}
    return {mode:'image'};
  }
  function render(appearance){
    const T=root.THREE,models=root.CityPeopleModels;
    if(!T||!models||!appearance)throw Error('Your City character is still loading. Try again in a moment.');
    const renderer=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
    let model;
    try{
      renderer.setSize(256,256,false);renderer.setClearColor(0x26384a);
      const scene=new T.Scene(),camera=new T.PerspectiveCamera(30,1,.01,10);
      model=models.create(appearance,{lod:0,modelDetail:5});root.PlatdoPremiumCity?.decorateModel?.(model,appearance);scene.add(model);
      const head=new T.Vector3();model.userData.rig.head.getWorldPosition(head);
      camera.position.set(head.x+.17,head.y+.1,head.z+1.22);camera.lookAt(head.x,head.y-.04,head.z);
      scene.add(new T.HemisphereLight(0xfff6e6,0x8795b1,1.8));
      const key=new T.DirectionalLight(0xffffff,2);key.position.set(2,3,4);scene.add(key);renderer.render(scene,camera);
      return renderer.domElement.toDataURL('image/jpeg',.88);
    }finally{if(model)models.dispose(model);renderer.dispose();renderer.forceContextLoss();}
  }
  function select(uid,mode){
    if(mode==='image'){store().remove('profilePortrait');return {mode:'image'};}
    if(mode!=='city')throw Error('Select a profile picture source.');
    const appearance=root.PlatdoAvatar?.get()?.appearance||root.CityPeople?.presets?.[0],key=JSON.stringify(appearance);
    const cached=read(uid);if(cached.key===key&&cached.image)return cached;
    const record={uid,mode,key,image:render(appearance)};store().set('profilePortrait',JSON.stringify(record));return record;
  }
  root.PlatdoProfilePortrait={read,select};
})(window);
