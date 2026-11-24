import {useState} from "react";
import {api} from "./Analysis";
import {parseTime} from "./timecode.mjs";
export function References({id,start,end,pages,choose}){
 const [items,set]=useState<any[]|null>(null),[status,tell]=useState("");
 async function search(){
 tell("Mencari ilustrasi…");
 try{const list=await api("source/"+id+"/references","POST",{start:parseTime(start),end:parseTime(end)});set(list);tell(list.length?"":"Belum ada ilustrasi berlisensi untuk rentang ini.");}catch(e){tell(e.message)}
 }
 return <details><summary>Persetujuan ilustrasi eksternal</summary><label className="check"><input type="checkbox" checked={!!pages} onChange={e=>choose(e.target.checked?[]:null)}/>Hanya pakai sumber yang saya setujui</label>{pages&&<><button className="soft" onClick={search}>Cari referensi untuk rentang ini</button><p role="status">{status}</p>{items?.map(i=><label key={i.page} className="check"><input type="checkbox" checked={pages.includes(i.page)} onChange={e=>choose(e.target.checked?[...pages,i.page]:pages.filter(p=>p!==i.page))}/><span><strong>[{(i.visualType||"ilustrasi").toUpperCase()}]</strong> <a href={i.page} target="_blank" rel="noreferrer">{i.title}</a> · {i.creator||i.sourceType||"Wikimedia Commons"} · {i.license} · +{i.at.toFixed(1)} dtk</span></label>)}</>}</details>;
}
