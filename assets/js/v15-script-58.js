
/* Stable authored garment families; editions change cut, trim and geometry as well as fabric. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CityCosmetics=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const stores=[{id:'clothing',name:'Platdo Basics',tone:'#d7b087'},{id:'clothing-drip',name:'Drip District',tone:'#63d5ce'},{id:'clothing-luxury',name:'Platdo Luxury',tone:'#d5bd7a'},{id:'clothing-oddball',name:'Oddball Outfitters',tone:'#e8a6dd'}];
const families={
 hats:['Six-panel cap','Cuffed beanie','Cowboy hat','Bucket hat','Fedora','Beret','Visor','Trapper hat','Racing helmet','Golden crown','Top hat','Wide sunhat','Banana hat','Pizza slice','Traffic cone','Cardboard helmet','Dinosaur hood','Chicken hood','Astronaut helmet','Pirate tricorn','Knight helmet','Robot helmet','Clown wig','Wizard hat','Alien helmet','Viking helmet'],
 tops:['Crew T-shirt','V-neck T-shirt','Polo shirt','Henley','Oxford shirt','Rolled shirt','Linen shirt','Dress shirt','Pullover hoodie','Zip hoodie','Crew sweatshirt','Cardigan','Denim jacket','Bomber jacket','Field jacket','Tailored blazer','Long coat','Rain shell','Track jacket','Basketball jersey','Utility vest','Tuxedo','Dinosaur suit','Chicken suit','Astronaut suit','Knight cuirass'],
 bottoms:['Straight jeans','Tapered jeans','Chinos','Formal trousers','Cargo pants','Wide-leg pants','Joggers','Track pants','Walking shorts','Athletic shorts','Pleated skirt','Cropped trousers','Racing trousers','Panel jeans','Utility overalls','Tuxedo trousers','Quilted pants','Balloon pants','Long skirt','Pirate breeches','Knight greaves','Robot legs','Dinosaur legs','Chicken legs','Astronaut trousers','Wizard robes'],
 shoes:['Canvas sneakers','Running shoes','Leather shoes','Ankle boots','Work boots','Loafers','Sandals','High-top sneakers','Basketball shoes','Racing boots','Chelsea boots','Platform shoes','Duck feet','Clown shoes','Knight boots','Robot boots','Astronaut boots','Dinosaur feet','Chicken feet','Pirate boots','Wizard slippers','Cowboy boots','Trail shoes','Luxury brogues','Futurist shoes','Roller shoes']
};
const editions=['Classic','Utility','Festival','Oversized'];
const colors=['#ded3b6','#364f71','#b15a43','#4d695b','#7d5488','#c2a14e','#3e9c9b','#343747'];
const rarity=['COMMON','UNCOMMON','RARE','EPIC','LEGENDARY'];
const baseUpper=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,15,8,10,17,20];
const baseLower=[0,1,2,3,4,5,6,7,8,9,10,11,7,0,4,3,5,5,10,11,4,3,6,8,4,10];
const items=[];
for(const [category,names] of Object.entries(families))for(let family=0;family<names.length;family++)for(let edition=0;edition<4;edition++){
 const slot={hats:'hat',tops:'upper',bottoms:'lower',shoes:'shoe'}[category],key={hats:'cosmeticHat',tops:'cosmeticTop',bottoms:'cosmeticBottom',shoes:'cosmeticShoe'}[category];
 const novelty=category==='hats'?family>=12:category==='tops'?family>=22:category==='bottoms'?family>=19:family>=12&&family<=20;
 const luxury=!novelty&&(category==='hats'?[4,9,10].includes(family):category==='tops'?[7,15,16,21].includes(family):category==='bottoms'?[3,15,18].includes(family):[2,5,10,23].includes(family));
 const shop=novelty?3:luxury?2:(edition===2||[8,13,18].includes(family))?1:0,grade=novelty?(family%3===0?3:2):luxury?(family===9?4:2):edition===0?0:1;
 const color=colors[(family+edition*2)%colors.length],accent=colors[(family+edition*2+3)%colors.length];
 const appearance={[key]:family*4+edition};
 if(slot==='hat')Object.assign(appearance,{hat:0,hatColor:color});
 if(slot==='upper')Object.assign(appearance,{upper:baseUpper[family],topColor:color,topAccentColor:accent,topPattern:edition===2?'chevron':edition===1?'panel':'plain'});
 if(slot==='lower')Object.assign(appearance,{lower:baseLower[family],bottomColor:color,bottomAccentColor:accent});
 if(slot==='shoe')Object.assign(appearance,{shoe:family<8?family:family%8,shoeColor:color,shoeAccentColor:accent});
 const id='style-'+category+'-'+String(family).padStart(2,'0')+'-'+edition;
 items.push(Object.freeze({id,name:editions[edition]+' '+names[family],kind:'cosmetic',category,slot,price:Math.round(([35,70,190,370,900][grade]+family*3+edition*18)*(slot==='shoe'?1.35:slot==='upper'?1.15:1)/5)*5,description:names[family]+' with '+['a clean fitted cut','layered utility panels and fastenings','raised decorative trim and festival detailing','an exaggerated silhouette and broad cuffs'][edition]+'.',appearance,store:'clothing',stores:[stores[shop].id],rarity:rarity[grade],family,edition,novelty}));
}
const byId=Object.fromEntries(items.map(x=>[x.id,x]));
const beardNames=['Clean shaven','Stubble','Heavy stubble','Short boxed','Full beard','Long beard','Goatee','Circle beard','Van Dyke','Balbo','Anchor','Chin strap','Chin curtain','Mutton chops','Friendly chops','Chevron moustache','Pencil moustache','Handlebar','Horseshoe','Walrus','Imperial','English moustache','Dali moustache','Soul patch','Chin puff','Ducktail','French fork','Braided beard','Rounded beard','Square beard'];
const outfitFamilies=[['Everyday',0,0,0,0],['Harbor worker',7,14,4,4],['Weekend runner',1,18,9,1],['Court star',0,19,9,8],['Black tie',10,21,15,23],['Space traveler',18,24,24,16],['Medieval',20,25,20,14],['Dinosaur',16,22,22,17],['Chicken',17,23,23,18],['Pirate',19,16,19,19],['Wizard',23,16,25,20],['Night rider',8,13,12,9]];
const outfits=outfitFamilies.map(([name,h,t,b,s],i)=>({id:'look-'+i,name,items:[['hats',h],['tops',t],['bottoms',b],['shoes',s]].map(([c,f])=>'style-'+c+'-'+String(f).padStart(2,'0')+'-'+(i%4))}));
return{stores,families,editions,items,byId,beardNames,outfits,rarity};
});

