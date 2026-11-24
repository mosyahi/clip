import {useEffect,useState} from "react";
import {builtIns,modes,styles} from "../server/style-registry.mjs";
const library=[...styles,...builtIns];

export function StyleLibrary({preset,apply}:{preset:string;apply:(name:string)=>void}){
  const [name,browse]=useState(preset);
  const [opened,setOpened]=useState(false);
  useEffect(()=>{if(library.some(s=>s.name===preset))browse(preset)},[preset]);
  const style=library.find(s=>s.name===name)||styles[0];
  const metadata="rules" in style?["Gerak masuk","Subtitle","Tempo","Kepadatan","Overlay","Aset","Tipografi","Transisi aset","Ritme cutaway","Saran suara"].map((label,i)=>[label,style.rules[i]]):[
    ["Gerak masuk",style.animationGrammar],["Subtitle",style.subtitleGrammar+" · hingga "+style.words+" kata"],
    ["Tempo",style.tempo+" · overlay "+style.pacingRules.hold+" dtk"],["Kepadatan","Jarak minimal "+style.sceneDensityRules.minGap+" dtk"],
    ["Overlay",style.overlayVocabulary.layout+" · "+style.overlayVocabulary.tag],["Aset",style.assetBehavior],
    ["Tipografi",style.font+" · "+style.typographyBehavior],["Transisi aset",style.transitionGrammar],
    ["Ritme cutaway",style.cutRhythm],["Saran suara",style.soundCueHints]
  ];
  return <details onToggle={e=>setOpened(e.currentTarget.open)}>
    <summary>Pustaka gaya dan mode edit</summary>
    <div className="fields">
      <label>Mode edit<select value="" onChange={e=>apply(modes[e.target.value])}><option value="" disabled>Pilih mode</option>{Object.keys(modes).map(n=><option key={n}>{n}</option>)}</select></label>
      <label>Bandingkan preset<select value={style.name} onChange={e=>browse(e.target.value)}>{library.map(s=><option key={s.name}>{s.name}</option>)}</select></label>
      {opened&&<video className="style-sample" key={style.type} poster={"/style-previews/"+style.type+".jpg"} src={"/style-previews/"+style.type+".mp4"} controls playsInline muted preload="metadata" aria-label={"Contoh render "+style.name}/>}
      <p><strong>{style.name}</strong><br/>{style.description}</p>
      <p><strong>Contoh penggunaan</strong><br/>{style.example}</p>
      <details><summary>Aturan editing</summary><dl className="style-rules">{metadata.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
      <button type="button" disabled={preset===style.name} onClick={()=>apply(style.name)}>{preset===style.name?"Gaya ini sedang dipakai":"Pakai "+style.name}</button>
    </div>
  </details>;
}
