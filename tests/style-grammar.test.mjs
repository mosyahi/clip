import assert from "node:assert/strict";
import test from "node:test";
import {styles,builtIns,recommendStyles,controlPresets,normalizeEditingControls} from "../server/style-registry.mjs";
import {styleScenes} from "../server/style-timeline.mjs";

test("setiap preset editorial punya tata visual lengkap, visualTreatment unik serta contoh berbeda",()=>{
 const required=["animationGrammar","subtitleGrammar","pacingRules","sceneDensityRules","overlayVocabulary","assetBehavior","typographyBehavior","transitionGrammar","cutRhythm","soundCueHints","visualTreatment"];
 const vtKeys=["filter","vignette","backdrop","frameStyle","cameraMotion","captionEffect"];
 for(const s of styles){
   for(const key of required)assert.ok(s[key],s.name+" / "+key);
   for(const k of vtKeys)assert.ok(s.visualTreatment[k],s.name+" / visualTreatment."+k);
   assert.ok(s.useCases[0].length>20,s.name);
 }
 assert.equal(new Set(styles.map(s=>s.overlayVocabulary.layout)).size,styles.length);
 assert.equal(new Set(styles.map(s=>s.visualTreatment.frameStyle)).size,styles.length);
 assert.equal(new Set(styles.map(s=>JSON.stringify(s.visualTreatment))).size,styles.length);
 assert.equal(builtIns.length,3);
 assert.equal(recommendStyles("ihsg indeks emiten di bursa")[0].name,"Clipper Finance Market");
 assert.equal(recommendStyles("pengajian tentang akhlak islam")[0].name,"Clipper Islamic Dakwah");
});

test("rencana rapat dan renggang menghormati batas klip dan ujaran",()=>{
 const segments=Array.from({length:10},(_,i)=>({start:i*2,end:i*2+1.8,text:"Akhirnya berhasil!"}));
 const get=name=>styleScenes(segments,2,17,styles.find(s=>s.type===name));
 const quick=get("meme"),slow=get("luxury");
 assert.ok(quick.length>slow.length);
 for(const s of [...quick,...slow])assert.ok(s.at>=0&&s.end<=15&&s.end>s.at);
 assert.deepEqual(get("meme"),quick);
});

test("klasifikasi scene dan pembedaan klaim vs fakta pada politik dan konspirasi",()=>{
 const konspirasi=styles.find(s=>s.type==="konspirasi");
 const politik=styles.find(s=>s.type==="politik");
 const segments=[
   {start:0,end:3,text:"Katanya ada rumor rahasia di balik pertemuan itu."},
   {start:9,end:13,text:"Menurut laporan resmi, angka inflasi tercatat 4 persen pada tahun 2024."},
 ];
 const kScenes=styleScenes(segments,0,14,konspirasi);
 const pScenes=styleScenes(segments,0,14,politik);
 assert.equal(kScenes[0].action,"klaim");
 assert.equal(kScenes[0].veracity,"klaim");
 assert.equal(pScenes[1].action,"timeline");
 assert.equal(pScenes[1].veracity,"fakta");
});

test("7 preset kontrol editing lanjutan dan visualDensity mengubah kepadatan scene secara nyata",()=>{
 const expected=["Clean","Balanced","Cinematic","Highly Visual","Viral Dynamic","Documentary Rich","Maximum Motion"];
 for(const name of expected){
   assert.ok(controlPresets[name],name);
   const norm=normalizeEditingControls({controlPreset:name});
   assert.equal(norm.controlPreset,name);
 }
 const segments=Array.from({length:12},(_,i)=>({start:i*2,end:i*2+1.7,text:"Data naik 25% sekarang!"}));
 const style=styles.find(s=>s.type==="finance");
 const sparse=styleScenes(segments,0,24,style,controlPresets.Clean.visualDensity);
 const dense=styleScenes(segments,0,24,style,controlPresets["Maximum Motion"].visualDensity);
 assert.ok(dense.length>sparse.length);
});
