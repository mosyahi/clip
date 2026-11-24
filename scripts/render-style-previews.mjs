import fs from "node:fs";
import path from "node:path";
import {film} from "../server/film.mjs";
import {cut,ffmpeg,metadata,run} from "../server/media.mjs";
import {builtIns,styles} from "../server/style-registry.mjs";
import {styleScenes} from "../server/style-timeline.mjs";

// A common silent source lets viewers compare the edit without changing the subject.
const duration=6, output=path.resolve("public/style-previews");
fs.mkdirSync(output,{recursive:true});
fs.mkdirSync(".cache",{recursive:true});
const temp=fs.mkdtempSync(path.resolve(".cache/preset-preview-"));
try {
 const source=path.join(temp,"studio.mp4");
 await run(ffmpeg,["-y","-v","error","-f","lavfi","-i","gradients=s=360x640:r=30:c0=0x192e3a:c1=0x647477:c2=0x162831:n=3:speed=0.015:seed=42","-t",String(duration),"-c:v","libx264","-pix_fmt","yuv420p",source]);
 const meta=await metadata(source);
 const asset=path.join(temp,"sample.jpg");
 await run(ffmpeg,["-y","-v","error","-i",source,"-frames:v","1",asset]);
 const requested=process.argv.slice(2);
 for(const style of [...styles,...builtIns].filter(s=>!requested.length||requested.includes(s.type))){
   const segments=[{start:0,end:3.2,text:style.example},{start:3.3,end:6,text:"Ada 3 hal yang perlu diperhatikan."}];
   const editorial=!style.rules;
   const plan={scenes:editorial?styleScenes(segments,0,duration,style):[]};
   const settings={preset:style.name,style:editorial?style:undefined,plan,font:style.font||"Arial",color:style.color||"#caf784",zoom:style.zoom??.5,start:0,end:duration,preview:true};
   const video=path.join(temp,style.type+".mp4");
   if(style.name==="Manual")await cut(source,video,settings,meta,()=>{});
   else await film(source,video,settings,meta,segments,style.type==="stack-pop"?[asset]:[],()=>{},temp);
   const info=await metadata(video);
   if(info.width!==360||info.height!==640||Math.abs(info.duration-duration)>.1)throw Error("Preview tidak valid: "+style.name);
   await run(ffmpeg,["-v","error","-i",video,"-f","null","-"]);
   await run(ffmpeg,["-y","-v","error","-ss","1.1","-i",video,"-frames:v","1",path.join(output,style.type+".jpg")]);
   fs.copyFileSync(video,path.join(output,style.type+".mp4"));
   console.log(style.name);
 }
}finally{fs.rmSync(temp,{recursive:true,force:true,maxRetries:4});}
