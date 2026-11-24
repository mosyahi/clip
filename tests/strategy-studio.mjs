import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawn} from "node:child_process";
const dir=fs.mkdtempSync(path.resolve(".cache/strategy-"));
const port=34316;
const server=spawn(process.execPath,["server/index.mjs","--production"],{windowsHide:true,env:{...process.env,PORT:String(port),DATA_DIR:dir,ASSET_MODE:"local-only"},stdio:"ignore"});
const sleep=()=>new Promise(r=>setTimeout(r,700));
async function api(route,data){
 const form=data instanceof FormData;
 const r=await fetch("http://127.0.0.1:"+port+"/api/"+route,data?{method:"POST",headers:form?{}:{"Content-Type":"application/json"},body:form?data:JSON.stringify(data)}:{});
 if(!r.ok)throw Error(await r.text());
 return r.json();
}
async function wait(fn){
 for(let i=0;i<500;i++){if(server.exitCode!==null)throw Error("Server stopped");const result=await fn();if(result)return result;await sleep();}
 throw Error("Timed out");
}
try{
 await wait(()=>api("state").catch(()=>false));
 const f=new FormData();f.append("video",new Blob([fs.readFileSync("data/bukti/ujaran-indonesia.mp4")]),"ujaran.mp4");
 const {id}=await api("source",f),url="source/"+id+"/";
 await api(url+"transcript",{language:"id"});
 const transcript=await wait(async()=>{const t=await api(url+"transcript");if(t.status==="gagal")throw Error(t.error);return t.segments?.length&&t;});
 const start=transcript.segments[0].start,end=start+3;
 const plan=await api(url+"strategy",{start,end});assert.equal(plan.suggestions.length,3);
 const {ids}=await api("render",{source:id,preset:"Otomatis",variants:true,preview:true,start,end,narration:"Selamat datang",autoIllustrate:true});
 assert.equal(ids.length,3);
 await wait(async()=>{const {jobs}=await api("state");for(const j of jobs)if(j.status==="gagal")throw Error(j.error);
 return jobs.filter(j=>ids.includes(j.id)&&j.status==="selesai").length===3;});
 console.log("Upload, transkrip, strategi dan tiga preview dengan narasi lulus.");
}finally{
 if(server.exitCode===null){const done=new Promise(r=>server.once("exit",r));server.kill();await done;}
 fs.rmSync(dir,{recursive:true,force:true,maxRetries:4});
}
