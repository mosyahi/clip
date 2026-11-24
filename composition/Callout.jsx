import React from "react";
export function Callout({scene,style,time}){
 const type=style.type,retro=type==="konspirasi",game=type==="game",news=["politik","berita","debat"].includes(type);
 const captions={quotes:"",podcast:"",game:"LEVEL",konspirasi:"CATATAN",politik:"ISU",dokumenter:"KONTEKS",motivasi:"",finance:"ANGKA",debat:"ARGUMEN",berita:"LAPORAN",wawancara:"",tutorial:"LANGKAH"};
 const label=scene.action!=="kutipan"||["quotes","motivasi","wawancara"].includes(type)?scene.label:scene.query;
 const tags={timeline:"LINIMASA",perbandingan:"PERBANDINGAN",langkah:"LANGKAH",statistik:"ANGKA",lokasi:"LOKASI",dokumen:"DOKUMEN"};
 const tag=tags[scene.action]||captions[type];
 const detail=scene.action==="timeline"?scene.label.match(/\b(?:19|20)\d\d\b/)?.[0]:
 scene.action==="statistik"?scene.label.match(/\d+(?:[.,]\d+)?%?/)?.[0]:null;
 return <div style={{position:"absolute",bottom:news?"34%":"36%",left:"7%",maxWidth:type==="quotes"?"86%":"74%",padding:retro?"20px 28px":"12px 22px",borderLeft:"8px solid "+style.color,borderBottom:game?"4px solid "+style.color:undefined,background:retro?"#e9dcc4":news?"#1b2942":"#111e",color:retro?"#231d19":"white",fontSize:type==="quotes"?48:36,fontFamily:game?"monospace":style.font,transform:retro?"rotate(-2deg)":undefined,opacity:Math.min(1,(time-scene.at)*8,(scene.end-time)*8)}}>
 {tag&&<small style={{display:"block",letterSpacing:3,color:retro?"#a52a24":style.color}}>{tag}</small>}{detail&&<strong style={{display:"block",fontSize:58}}>{detail}</strong>}{label}</div>;
}
