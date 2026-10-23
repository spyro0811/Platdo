/* Local asset loading. All paths resolve relative to index.html, including GitHub project pages. */
(function(global){'use strict';
 const binary=new Map(),images=new Map();
 async function checked(url){const response=await fetch(url);if(!response.ok)throw new Error('Asset request failed: '+url+' ('+response.status+')');return response;}
 function arrayBuffer(path){
  if(!binary.has(path)){const pending=checked(new URL(path,document.baseURI)).then(response=>response.arrayBuffer());binary.set(path,pending);pending.catch(()=>binary.delete(path));}
  return binary.get(path).then(buffer=>buffer.slice(0));
 }
 function imageURL(path){
  if(!path.endsWith('.png.json'))return Promise.resolve(path);
  if(!images.has(path)){
   const pending=(async()=>{const url=new URL(path,document.baseURI),manifest=await(await checked(url)).json();
    const parts=await Promise.all(manifest.parts.map(async part=>(await checked(new URL(part,url))).arrayBuffer()));
    const blob=new Blob(parts,{type:manifest.mime});if(blob.size!==manifest.bytes)throw new Error('Incomplete animation: '+path);
    return URL.createObjectURL(blob);
   })();images.set(path,pending);pending.catch(()=>images.delete(path));
  }
  return images.get(path);
 }
 function setImageSource(image,path){
  if(image.dataset.assetLoading===path)return;
  image.dataset.assetLoading=path;
  imageURL(path).then(url=>{if(image.dataset.assetLoading===path)image.src=url;}).catch(error=>{delete image.dataset.assetLoading;console.error('Animation could not be loaded',error);});
 }
 global.PlatdoAssets={arrayBuffer,imageURL,setImageSource};
})(window);
