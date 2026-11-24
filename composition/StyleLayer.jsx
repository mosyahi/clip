import React from "react";

// Each treatment defines its own silhouette and anchor on the portrait canvas.
const layouts = {
 kutipan:{left:"11%",right:"11%",textAlign:"center",borderTop:"2px solid",background:"rgba(18,15,11,0.78)",fontStyle:"italic"},
 mikrofon:{left:"9%",right:"9%",textAlign:"center",borderRadius:24,border:"2px solid",background:"rgba(12,20,17,0.84)"},
 hud:{right:"7%",border:"3px solid",clipPath:"polygon(0 0,100% 0,100% 74%,92% 100%,0 100%)",background:"rgba(6,18,24,0.88)"},
 catatan:{left:"8%",background:"#f1dfbd",color:"#322820",boxShadow:"9px 9px #702e29"},
 rubrik:{left:0,borderLeft:"20px solid",borderBottom:"2px solid",background:"rgba(14,22,36,0.92)"},
 arsip:{left:"8%",background:"#191c19e8",borderTop:"2px solid",padding:"22px 38px"},
 manifesto:{left:"8%",right:"8%",background:"rgba(16,12,6,0.82)",borderLeft:"10px solid",fontWeight:900,fontSize:48},
 neraca:{right:"7%",borderRight:"8px solid",textAlign:"right",background:"rgba(8,22,16,0.9)"},
 argumen:{left:"7%",borderLeft:"12px double",background:"#362729ee"},
 kilat:{left:0,right:0,background:"#8d1c2df0",borderBottom:"7px solid"},
 bab:{left:"10%",background:"#291e31eb",borderRadius:"0 42px 42px 0"},
 langkah:{left:"7%",borderRadius:18,border:"3px solid",background:"rgba(12,24,32,0.9)"},
 desk:{left:0,right:"7%",borderLeft:"25px solid",background:"linear-gradient(100deg,#112947,#254d71)",borderBottom:"5px solid"},
 bayangan:{left:"10%",right:"10%",background:"rgba(6,2,8,0.78)",textAlign:"center",textShadow:"0 4px 16px black,0 0 18px #5e183a",letterSpacing:3,borderBottom:"1px solid"},
 galeri:{left:"14%",right:"14%",borderTop:"2px solid",borderBottom:"2px solid",textAlign:"center",background:"#27221eed",padding:"32px 14px"},
 stiker:{right:"7%",background:"#eaff44",color:"#101014",border:"6px solid #101014",borderRadius:24,boxShadow:"10px 10px #101014",fontWeight:900},
 renungan:{left:"11%",right:"11%",borderRadius:"80px 80px 12px 12px",border:"2px solid",background:"#143c36ed",textAlign:"center"},
 papan:{left:"8%",borderRadius:"7px 32px 32px 7px",background:"#dff8fd",color:"#193948",borderLeft:"14px solid"},
 vox:{left:"6%",borderLeft:"14px solid",background:"#25221eee",borderRadius:"0 30px 30px 0"},
 terminal:{left:0,right:0,borderTop:"3px solid",background:"#0d2825f2",fontVariantNumeric:"tabular-nums"},
 spesifikasi:{right:"7%",border:"2px solid",background:"#202333ed",boxShadow:"inset 0 -6px #898fed"},
 berkas:{left:"8%",borderTop:"8px double",background:"#dfd5c3",color:"#312d26",boxShadow:"6px 6px #807663"}
};

// Caption treatments stay recognizable between cutaways.
const captionSkins = {
  kutipan:{fontStyle:"italic",textShadow:"0 3px 10px #080807",background:"rgba(16,13,9,0.56)",borderRadius:14},
  mikrofon:{borderRadius:22,background:"#101a17d4"},
  hud:{borderBottom:"4px solid",textAlign:"right",background:"rgba(4,16,22,0.72)"},
  catatan:{textAlign:"left",fontFamily:"Courier New",background:"rgba(24,18,14,0.78)",borderLeft:"6px solid"},
  rubrik:{textAlign:"left",borderTop:"2px solid",background:"#172538e0"},
  arsip:{letterSpacing:1.8,background:"#15201bd4",borderTop:"1px solid"},
  manifesto:{lineHeight:1.03,letterSpacing:-2,background:"rgba(12,10,6,0.52)"},
  neraca:{textAlign:"right",fontVariantNumeric:"tabular-nums",background:"#13271fe8",borderRight:"6px solid"},
  argumen:{borderLeft:"10px double",textAlign:"left",background:"rgba(34,18,22,0.8)"},
  kilat:{textAlign:"left",fontWeight:900,background:"#40121ff2",borderLeft:"8px solid"},
  bab:{fontStyle:"italic",borderRadius:32,background:"#281d2acc"},
  langkah:{textAlign:"left",background:"#17222ae0",borderRadius:16,borderBottom:"3px solid"},
  desk:{textAlign:"left",borderLeft:"9px solid",background:"#0e2238f2"},
  bayangan:{letterSpacing:3.5,textShadow:"1px 3px 12px #000, 0 0 20px #6d3043",background:"rgba(8,3,10,0.62)"},
  galeri:{fontWeight:400,letterSpacing:3.5,borderTop:"1px solid",paddingTop:18,background:"rgba(18,15,12,0.58)"},
  stiker:{fontWeight:900,letterSpacing:-0.5,transform:"rotate(-2deg)",WebkitTextStroke:"1px #111"},
  renungan:{lineHeight:1.42,background:"#102b27c8",borderRadius:24},
  papan:{textAlign:"left",borderLeft:"12px solid",borderRadius:"0 18px 18px 0",background:"#152f3be8"},
  vox:{textAlign:"left",transform:"rotate(-1deg)",background:"#231d18d4"},
  terminal:{textAlign:"left",borderTop:"3px solid",background:"#071d18f2"},
  spesifikasi:{textAlign:"right",background:"#1c1d2beb",borderRight:"5px solid"},
  berkas:{textAlign:"left",background:"#22201deb",borderBottom:"3px double"}
};

const motion = (kind, p, amp = 1) => ({
 geser:`translateX(${(p - 1) * 70 * amp}px)`,
 naik:`translateY(${(1 - p) * 26 * amp}px)`,
 angkat:`translateY(${(1 - p) * 52 * amp}px) scale(${1 - 0.06 * amp * (1 - p)})`,
 sentak:`scale(${1 + (1 - p) * 0.22 * amp})`,
 tempel:`rotate(${(-2 - (1 - p) * 6) * amp}deg) scale(${1 - 0.08 * amp * (1 - p)})`,
 larut:`translateY(${(1 - p) * 10 * amp}px) scale(${1 - 0.02 * amp * (1 - p)})`,
 buka:`scaleX(${1 - 0.12 * amp * (1 - p)})`,
 diam:"none"
})[kind] || "none";

export function FrameDecoration({ style, time, accent }) {
  const frameStyle = style?.visualTreatment?.frameStyle;
  if (!frameStyle) return null;
  const pulse = 0.55 + 0.45 * Math.sin(time * 3);
  const commonTag = {
    position: "absolute",
    top: "3.2%",
    left: "7%",
    fontSize: 21,
    fontWeight: 700,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    padding: "5px 14px",
    borderRadius: 6,
    color: "white",
    background: "rgba(10,14,18,0.68)",
    border: "1px solid " + accent + "88",
    pointerEvents: "none",
  };

  if (frameStyle === "cinema-quote" || frameStyle === "archival-film") {
    return <>
      <div style={{position:"absolute",top:0,left:0,right:0,height:"3.4%",background:"#070808"}}/>
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:"3.4%",background:"#070808"}}/>
      <div style={{...commonTag,top:"4.5%",fontFamily:"Georgia",fontStyle:"italic",borderColor:accent+"66"}}>
        {frameStyle==="cinema-quote" ? "“ KUTIPAN" : "ARSIP · " + style.overlayVocabulary.tag}
      </div>
    </>;
  }
  if (frameStyle === "cyber-hud" || frameStyle === "spec-blueprint") {
    const corner = {position:"absolute",width:42,height:42,borderColor:accent,pointerEvents:"none"};
    return <>
      <div style={{...corner,top:"4%",left:"5%",borderTop:"4px solid",borderLeft:"4px solid"}}/>
      <div style={{...corner,top:"4%",right:"5%",borderTop:"4px solid",borderRight:"4px solid"}}/>
      <div style={{...corner,bottom:"11%",left:"5%",borderBottom:"4px solid",borderLeft:"4px solid"}}/>
      <div style={{...corner,bottom:"11%",right:"5%",borderBottom:"4px solid",borderRight:"4px solid"}}/>
      <div style={{position:"absolute",inset:0,background:"repeating-linear-gradient(0deg, transparent, transparent 6px, rgba(255,255,255,0.025) 7px)",pointerEvents:"none"}}/>
      <div style={{...commonTag,top:"4.2%",background:"rgba(4,16,22,0.8)",color:accent}}>
        ● {frameStyle==="cyber-hud" ? "HUD // REC" : "SPEC // LAB"}
      </div>
    </>;
  }
  if (frameStyle === "breaking-banner" || frameStyle === "broadcast-desk" || frameStyle === "civic-ticker" || frameStyle === "market-terminal") {
    return <>
      <div style={{position:"absolute",top:0,left:0,right:0,height:10,background:accent}}/>
      <div style={{...commonTag,top:"2.6%",background:frameStyle==="breaking-banner"?"#8d1c2d":frameStyle==="market-terminal"?"#071d18":"#112947",borderLeft:"8px solid "+accent,borderRadius:2}}>
        {frameStyle==="breaking-banner" ? "LAPORAN KILAT" : frameStyle==="market-terminal" ? "TERMINAL PASAR" : style.overlayVocabulary.tag}
      </div>
    </>;
  }
  if (frameStyle === "red-thread" || frameStyle === "case-dossier") {
    return <>
      <div style={{position:"absolute",inset:"2.4%",border:"2px dashed "+accent+"88",pointerEvents:"none"}}/>
      <div style={{...commonTag,top:"3.6%",background:frameStyle==="red-thread"?"#381414":"#26221c",color:accent,fontFamily:"Courier New"}}>
        [{frameStyle==="red-thread" ? "CATATAN · PERLU VERIFIKASI" : "BERKAS KRONOLOGI"}]
      </div>
    </>;
  }
  if (frameStyle === "gold-atelier" || frameStyle === "islamic-arch") {
    return <div style={{
      position:"absolute",inset:"2.8%",pointerEvents:"none",
      border:"2px solid "+accent+"88",
      borderRadius:frameStyle==="islamic-arch"?"120px 120px 18px 18px":4,
      boxShadow:"inset 0 0 0 6px transparent, inset 0 0 0 7px "+accent+"33"
    }}/>;
  }
  if (frameStyle === "shadow-veil") {
    return <div style={{position:"absolute",inset:0,boxShadow:"inset 0 0 110px rgba(0,0,0,0.92)",border:"1px solid rgba(209,181,190,0.18)",pointerEvents:"none"}}/>;
  }
  if (frameStyle === "comic-sticker") {
    return <>
      <div style={{position:"absolute",inset:"1.6%",border:"6px solid #101014",boxShadow:"inset 0 0 0 3px "+accent,pointerEvents:"none"}}/>
      <div style={{...commonTag,top:"3.4%",background:accent,color:"#101014",border:"3px solid #101014",transform:"rotate(-2deg)",fontWeight:900}}>
        REAKSI!
      </div>
    </>;
  }
  if (frameStyle === "studio-badge") {
    return <div style={{...commonTag,top:"3.2%",borderRadius:20,opacity:0.85}}>
      <span style={{color:accent,opacity:pulse}}>●</span> PODCAST CLIP
    </div>;
  }
  return <div style={{...commonTag,top:"3.2%",borderLeft:"6px solid "+accent}}>
    {style.overlayVocabulary.tag}
  </div>;
}

function resolveTag(style, scene) {
  const base = style.overlayVocabulary.tag;
  if (!scene?.veracity) return base;
  if (scene.veracity === "klaim") return "KLAIM / OPINI · BELUM TERVERIFIKASI";
  if (scene.veracity === "fakta") return "DATA / RUJUKAN · " + base;
  if (["politik", "konspirasi", "debat", "crime"].includes(style.type)) return "KONTEKS · " + base;
  return base;
}

function SceneVisualGraphic({ scene, accent, p, paper }) {
  if (!scene) return null;
  if (scene.visualType === "grafik" && scene.chartData) {
    const cd = scene.chartData;
    if (cd.kind === "stat") {
      const pct = Math.max(6, Math.min(100, Math.round((cd.percent || 50) * p)));
      return (
        <div style={{marginTop:12,padding:"12px 16px",borderRadius:10,background:paper?"rgba(40,34,26,0.12)":"rgba(255,255,255,0.08)",border:"1px solid "+accent+"66"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:12,marginBottom:8}}>
            <span style={{fontSize:18,letterSpacing:2,opacity:0.85,textTransform:"uppercase"}}>GRAFIK DATA</span>
            {cd.value && <strong style={{fontSize:38,color:paper?"#7c2d12":accent,fontVariantNumeric:"tabular-nums"}}>{cd.value}</strong>}
          </div>
          <div style={{height:12,borderRadius:6,background:"rgba(255,255,255,0.14)",overflow:"hidden"}}>
            <div style={{width:pct+"%",height:"100%",borderRadius:6,background:paper?"#7c2d12":accent}}/>
          </div>
        </div>
      );
    }
    if (cd.kind === "compare") {
      return (
        <div style={{marginTop:12,display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:10,alignItems:"center",padding:"10px 14px",borderRadius:10,background:paper?"rgba(40,34,26,0.12)":"rgba(255,255,255,0.08)",border:"1px solid "+accent+"55"}}>
          <div style={{fontSize:22,fontWeight:700,borderLeft:"5px solid "+accent,paddingLeft:8}}>{cd.left}</div>
          <div style={{fontSize:18,fontWeight:900,color:paper?"#7c2d12":accent}}>VS</div>
          <div style={{fontSize:22,fontWeight:700,borderRight:"5px solid #e2e8f0",paddingRight:8,textAlign:"right"}}>{cd.right}</div>
        </div>
      );
    }
    if (cd.kind === "timeline") {
      return (
        <div style={{marginTop:12,display:"flex",alignItems:"center",gap:14,padding:"10px 14px",borderRadius:10,background:paper?"rgba(40,34,26,0.12)":"rgba(255,255,255,0.08)"}}>
          <span style={{padding:"4px 12px",borderRadius:20,background:paper?"#7c2d12":accent,color:paper?"#fff":"#111",fontWeight:900,fontSize:24,fontVariantNumeric:"tabular-nums"}}>{cd.year}</span>
          <div style={{flex:1,height:4,background:accent+"55",borderRadius:2,overflow:"hidden"}}>
            <div style={{width:Math.round(p*100)+"%",height:"100%",background:paper?"#7c2d12":accent}}/>
          </div>
        </div>
      );
    }
  }
  if (scene.visualType === "motion" && scene.motionData) {
    const md = scene.motionData;
    if (md.kind === "step") {
      return (
        <div style={{marginTop:10,display:"flex",alignItems:"center",gap:12}}>
          <span style={{padding:"4px 14px",borderRadius:999,background:accent,color:"#111",fontWeight:900,fontSize:20,letterSpacing:1.5}}>
            LANGKAH {md.stepNumber || 1}
          </span>
          <div style={{flex:1,height:4,borderRadius:2,background:"rgba(255,255,255,0.18)"}}>
            <div style={{width:Math.round(p*100)+"%",height:"100%",background:accent}}/>
          </div>
        </div>
      );
    }
    if (md.kind === "question") {
      return (
        <div style={{marginTop:10,display:"inline-flex",alignItems:"center",gap:8,padding:"3px 12px",borderRadius:8,background:accent+"26",border:"1px solid "+accent}}>
          <strong style={{fontSize:24,color:paper?"#7c2d12":accent}}>?</strong>
          <span style={{fontSize:18,letterSpacing:1.5,textTransform:"uppercase"}}>PERTANYAAN UTAMA</span>
        </div>
      );
    }
  }
  return null;
}

export function StyleLayer({style,scene,group,time,settings={}}){
 const accent=settings.color||style.color;
 const face=settings.font||style.font;
 const type=style.typographyBehavior;
 const animAmp = 0.35 + 0.85 * (settings.animationIntensity ?? 0.6);
 const transSpeed = settings.transitionSpeed ?? 1.0;
 const p=scene?Math.min(1,Math.max(0,((time-scene.at)*transSpeed)/(style.animationGrammar==="larut"?.75:.22))):1;
 const layout=layouts[style.overlayVocabulary.layout];
 const caption=(settings.subtitleAnimation && settings.subtitleAnimation !== "Auto") ? settings.subtitleAnimation : style.subtitleGrammar;
 const subSize = settings.subtitleSize || style.size;
 const substyle = settings.substyle || "Default";
 const safeArea = settings.safeArea || "universal";
 const safeInsets =
   safeArea === "tiktok"
     ? { left: "7%", right: "13%", bottom: "19%" }
     : safeArea === "reels"
       ? { left: "7%", right: "11%", bottom: "18%" }
       : safeArea === "shorts"
         ? { left: "7%", right: "11%", bottom: "17%" }
         : { left: "7%", right: "7%", bottom: "16%" };
 const subPosStyle =
   settings.position === "Atas"
     ? { top: "14%", left: safeInsets.left, right: safeInsets.right }
     : { top: "54%", left: safeInsets.left, right: safeInsets.right };
 const isEditorialBox = substyle === "Editorial";
 const substyleSkin =
   isEditorialBox
     ? { ...captionSkins[style.overlayVocabulary.layout] }
     : substyle === "Neon"
       ? { background: "transparent", border: "none", textShadow: "0 0 16px " + accent + ", 0 4px 14px #000" }
       : { background: "transparent", border: "none", boxShadow: "none" };
 const paper=["berkas","papan","catatan","stiker"].includes(style.overlayVocabulary.layout);
 const sceneFade = scene ? Math.min(p, Math.max(0, (scene.end - time) * 6 * transSpeed)) : 0;
 const isClaim = scene?.veracity === "klaim";
 const tagText = scene ? resolveTag(style, scene) : "";
 const beat = settings.plan?.edl?.find((b) => time >= b.at && time < b.end);
 const emphasisSet = new Set((beat?.emphasisKeywords || []).map((k) => k.toLowerCase()));
 const hasGraphicData = Boolean(
   scene &&
     ((scene.visualType === "grafik" && scene.chartData) ||
       (scene.visualType === "motion" && scene.motionData)),
 );
 const showSceneOverlay =
   scene &&
   !beat?.restraint &&
   (hasGraphicData || isEditorialBox) &&
   !(style.overlayVocabulary.layout === "mikrofon" && scene.action === "kutipan");

 // Transition effect when a scene appears based on transitionGrammar
 const transitionWindow = scene ? Math.max(0, 1 - (time - scene.at) * 5) : 0;

 return <>
 {isEditorialBox && <FrameDecoration style={style} time={time} accent={accent}/>}
 {scene && transitionWindow > 0 && style.transitionGrammar === "potong" && (
   <div style={{position:"absolute",inset:0,background:accent,opacity:transitionWindow * 0.14,pointerEvents:"none"}}/>
 )}
 {showSceneOverlay && (
   <div style={{position:"absolute",top:"26%",maxWidth:"88%",padding:"18px 30px",fontSize:36,
     background:"#111820e8",color:"white",fontFamily:face,...layout,
     borderColor:isClaim ? "#f59e0b" : paper ? "#403a34" : accent,
     opacity:sceneFade,transform:motion(style.animationGrammar,p,animAmp),
     clipPath:style.animationGrammar==="buka"?`inset(0 ${100*(1-p)}% 0 0)`:layout.clipPath}}>
     <div style={{fontFamily:"Arial",fontWeight:700,fontSize:20,letterSpacing:2,textTransform:"uppercase",
       display:"inline-block",
       padding:isClaim?"4px 10px":0,
       borderRadius:isClaim?4:0,
       background:isClaim?(paper?"#991b1b":"rgba(180,83,9,0.34)"):"transparent",
       color:isClaim?(paper?"#fef3c7":"#fcd34d"):paper?"#423c35":accent,marginBottom:8}}>
       {tagText}
     </div>
     <div>{scene.headline || scene.label}</div>
     <SceneVisualGraphic scene={scene} accent={accent} p={p} paper={paper}/>
   </div>
 )}
 {group?.length>0&&settings.subtitles!==false&&<div style={{position:"absolute",...subPosStyle,
   textAlign:"center",fontSize:Math.min(58, subSize),fontStyle:type==="serif miring"?"italic":"normal",
   fontWeight:900,letterSpacing:-0.5,lineHeight:1.18,
   textTransform:"uppercase",fontVariantNumeric:"tabular-nums",color:"#ffffff",
   WebkitTextStroke:isEditorialBox ? undefined : "10px #000000",
   paintOrder:"stroke fill",
   textShadow:"0 4px 14px rgba(0,0,0,0.92)",
   padding:"6px 12px",...substyleSkin,borderColor:accent,fontFamily:face}}>
   {group.map((word,i)=>{
    const active=time>=word.start&&time<word.end;
    const dur=Math.max(0.08, word.end - word.start);
    const wp=active?Math.min(1,Math.max(0,(time-word.start)/Math.min(0.18,dur))):0;
    const filled=active&&caption==="blok"&&isEditorialBox;
    const colored=(active&&caption==="karaoke")||(caption==="angka"&&/\d/.test(word.text));
    let wordTransform = "none";
    if (active && (caption === "karaoke" || caption === "blok")) {
      wordTransform = `translateY(${-2 * animAmp * wp}px) scale(${1 + 0.05 * animAmp * wp})`;
    }
    const wordOpacity = caption === "muncul"
      ? (time < word.start ? 0.15 : Math.min(1, 0.45 + (time - word.start) * 6))
      : 1;
    const cleanToken = word.text.replace(/[^\p{L}\d%]/gu, "").toLowerCase();
    const isKeywordEmphasis = emphasisSet.has(cleanToken);
    return <span key={i} style={{
      display:"inline-block",
      margin:"0 7px",
      padding:filled ? "2px 10px" : "0 2px",
      borderRadius:filled ? 10 : 0,
      opacity:wordOpacity,
      transform:wordTransform,
      color:filled?"#141416":(colored||isKeywordEmphasis)&&isEditorialBox?accent:"#ffffff",
      background:filled?accent:undefined,
    }}>{word.text}</span>;
   })}
 </div>}
 </>;
}
