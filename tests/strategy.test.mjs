import assert from "node:assert/strict";
import test from "node:test";
import {analyze} from "../server/content-intelligence.mjs";
import {styles} from "../server/style-registry.mjs";
import {styleScenes} from "../server/style-timeline.mjs";
import {narrate} from "../server/voice.mjs";
import {recommend} from "../server/highlights.mjs";
test("analisis per rentang dan referensi bertimestamp",()=>{
 const a=analyze([{start:0,end:5,text:"Pemilu dan presiden."},{start:7,end:15,text:"Game ini punya 4 level dan boss."}],7,15);
 assert.equal(a.type,"game");assert.equal(a.scenes[0].action,"statistik");assert.equal(a.scenes[0].at,0);
 assert.equal(a.suggestions.length,3);assert.ok(!a.keywords.includes("pemilu"));assert.equal(new Set(styles.map(s=>s.name)).size,22);
 assert.equal(analyze([],0,1).status,"unavailable");
});
test("provider dinonaktifkan memakai audio asli dan seleksi lokal",async()=>{
 process.env.TTS_MODE="disabled";process.env.LLM_MODE="disabled";
 try{assert.equal(await narrate("uji","."),false);
 const r=await recommend([{start:0,end:18,text:"Bagaimana cara bermain game ini?"}],{min:15,count:3,provider:true});
 assert.equal(r.clips.length,1);assert.match(r.mode,/lokal/);
 }finally{delete process.env.TTS_MODE;delete process.env.LLM_MODE;}
});

test("rekomendasi 5 tipe visual per scene beserta chartData dan motionData",()=>{
 const finance=styles.find(s=>s.type==="finance");
 const segs=[
   {start:0,end:4,text:"Inflasi naik 45% pada kuartal ini."},
   {start:12,end:16,text:"Pertama siapkan dana darurat sebelum investasi."},
   {start:24,end:28,text:"Saham vs obligasi memiliki risiko berbeda."},
   {start:36,end:40,text:"Suasana pasar dan gedung bursa cukup ramai."},
   {start:48,end:52,text:"Foto kamera dan mesin tik kuno di museum."}
 ];
 const scenes=styleScenes(segs,0,54,finance);
 assert.equal(scenes[0].visualType,"grafik");
 assert.equal(scenes[0].chartData.kind,"stat");
 assert.equal(scenes[1].visualType,"motion");
 assert.equal(scenes[1].motionData.kind,"step");
 assert.equal(scenes[2].visualType,"grafik");
 assert.equal(scenes[2].chartData.kind,"compare");
 assert.equal(scenes[3].visualType,"b-roll");
 assert.equal(scenes[4].visualType,"foto");
 const doc=styles.find(s=>s.type==="dokumenter");
 assert.equal(styleScenes([{start:0,end:4,text:"Sejarah candi dan museum kuno."}],0,6,doc)[0].visualType,"ilustrasi");
});
