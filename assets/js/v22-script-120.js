
/* The display is a Drive model. City never registers it as a road vehicle. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object')module.exports=api;
  root.CityHomeGarage=api;
})(typeof globalThis==='undefined'?window:globalThis,function(root){
  'use strict';
  function dimensions(selection){
    const vehicle=selection||root.PlatdoDrive?.garageDisplay?.()||{};
    const carWidth=Number(vehicle.carWidth||vehicle.width)||1.78;
    const carLength=Number(vehicle.carLength||vehicle.length)||4.12;
    return {width:Math.max(6.60,carWidth+2.40),depth:Math.max(7.60,carLength+2.20),carWidth,carLength};
  }
  function clear(renderer){
    const car=renderer.launcher;if(!car)return;
    car.removeFromParent();
    const materials=new Set(), geometries=new Set();
    car.traverse(node=>{
      if(node.geometry)geometries.add(node.geometry);
      for(const m of [].concat(node.material||[]))materials.add(m);
    });
    for(const geometry of geometries)geometry.dispose();
    for(const material of materials)material.dispose();
    renderer.launcher=null;
  }
  function update(renderer,sim){
    const now=performance.now();
    if(now<(renderer.garageCheckAt||0))return;
    renderer.garageCheckAt=now+350;
    const display=root.PlatdoDrive?.garageDisplay?.(),home=sim.world.home;
    if(!display||!home||renderer.launcher&&renderer.launcherKey===display.key)return;
    const car=display.create();
    if(!car)return;
    const size=dimensions(car.userData.garageSize);
    home.resizeGarage(size.width,size.depth,size.carWidth,size.carLength);
    const at=home.toLocal(home.launcher.x,home.launcher.y,home.launcher.z);
    clear(renderer);
    renderer.launcher=car;
    renderer.launcherKey=display.key;
    car.position.set(at.x,at.y,at.z);
    car.rotation.y=Math.PI;
    if(renderer.group.scale.x<0)car.scale.x=-car.scale.x;
    renderer.group.add(car);
  }
  return {dimensions,update,clear};
});

