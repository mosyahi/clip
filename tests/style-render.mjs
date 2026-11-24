import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {film} from "../server/film.mjs";
import {metadata} from "../server/media.mjs";
import {styles} from "../server/style-registry.mjs";
import {analyze} from "../server/content-intelligence.mjs";
const input=path.resolve("data/bukti/ujaran-indonesia.mp4");
const meta=await metadata(input);
const dir=fs.mkdtempSync(path.resolve(".cache/styles-"));
try{
 const segments=[{start:0,end:2.5,text:"Mengapa game ini punya 3 level?"}];
 const plan=analyze(segments,0,2.5);
 assert.equal(plan.suggestions[0].name,"Clipper Game");
 for(const style of styles){
 const output=path.join(dir,style.type+".mp4");
 await film(input,output,{start:0,end:2.5,preview:true,preset:style.name,style,plan,font:style.font,color:style.color,zoom:style.zoom},meta,segments,[],()=>{},dir);
 assert.ok((await metadata(output)).duration>=2.45);
 console.log(style.name);
 }
}finally{fs.rmSync(dir,{recursive:true,force:true})}
