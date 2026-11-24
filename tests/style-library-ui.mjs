import assert from "node:assert/strict";
import {chromium} from "playwright-core";
import {styles,builtIns} from "../server/style-registry.mjs";

const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"});
try{
 const page=await browser.newPage(),errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await page.goto(process.env.STUDIO_URL||"http://127.0.0.1:3210");
 await page.getByText("Pustaka gaya dan mode edit",{exact:true}).click();
 await page.getByText("Aturan editing",{exact:true}).click();
 const selector=page.getByRole("combobox",{name:/Bandingkan preset/});
 for(const style of [...styles,...builtIns]){
   await selector.selectOption(style.name);
   const player=page.getByLabel("Contoh render "+style.name,{exact:true});
   await player.evaluate(async video=>{
     await video.play();
     video.pause();
     if(video.videoWidth!==360||video.videoHeight!==640)throw Error("Resolusi preview salah.");
     const poster=new Image();poster.src=video.poster;await poster.decode();
   });
   assert.equal(await page.locator(".style-rules dt").count(),10);
   assert.equal(await page.getByText(style.example,{exact:false}).count()>0,true);
 }
 await selector.selectOption("Clipper True Crime");
 await page.getByRole("button",{name:"Pakai Clipper True Crime"}).click();
 assert.equal(await page.locator("select").filter({has:page.locator('option[value="Otomatis"],option:text-is("Otomatis")')}).first().inputValue(),"Clipper True Crime");
 assert.deepEqual(errors,[]);
 console.log("25 preview, poster, metadata, contoh penggunaan dan penerapan preset lulus.");
}finally{await browser.close();}
