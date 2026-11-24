import fs from "node:fs/promises";
import path from "node:path";
// Provider milik operator mengembalikan satu JPEG berlisensi per kueri.
export async function stockShot(query,dir,name){
 const endpoint=process.env.STOCK_SEARCH_URL;
 if(!endpoint||["disabled","local-only"].includes(process.env.ASSET_MODE))return;
 try{
 const url=new URL(endpoint);url.searchParams.set("q",query);
 const options={redirect:"error",signal:AbortSignal.timeout(10000)};
 const response=await fetch(url,options);
 if(!response.ok)return;
 const item=await response.json();
 if(!["CC0","Public domain","CC BY 4.0"].includes(item.license)||!item.title||!item.creator)return;
 const page=new URL(item.page),image=new URL(item.image,url);
 if(!["https:","http:"].includes(page.protocol)||image.origin!==url.origin)return;
 const photo=await fetch(image,options);
 if(!photo.ok||photo.headers.get("content-type")?.split(";")[0]!=="image/jpeg")return;
 const chunks=[];let size=0;
 for await(const chunk of photo.body){size+=chunk.length;if(size>8*1024*1024)return;chunks.push(chunk);}
 const bytes=Buffer.concat(chunks);
 if(bytes.length<3||bytes.readUInt16BE(0)!==0xffd8)return;
 await fs.writeFile(path.join(dir,name),bytes);
 return {name,title:item.title,page:page.href,license:item.license,creator:item.creator,provider:"stock"};
 }catch{return;}
}
