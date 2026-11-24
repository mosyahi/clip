export const modes={"Safe clean":"Clipper Podcast","Viral aggressive":"Clipper Motivation","Documentary rich":"Clipper Documentary","Political analysis":"Clipper Politik","Conspiracy dramatic":"Clipper Konspirasi","Gaming hype":"Clipper Game"};
import {profiles} from "./style-profiles.mjs";
const definitions = [
 ["Quotes","Renungan dengan kutipan besar","quotes","hidup makna bijak cinta","Georgia","#ffe3aa",84,4,.12],
 ["Podcast","Percakapan dengan sorotan kata","podcast","obrol ngobrol podcast tamu","Arial","#caf784",70,5,.38],
 ["Game","Caption cepat bergaya HUD","game","game gaming level boss pemain","Verdana","#40fce0",78,3,.62],
 ["Konspirasi","Catatan bukti dengan aksen merah","konspirasi","teori misteri bukti rahasia","Georgia","#ff7367",66,4,.28],
 ["Politik","Judul editorial dan penanda isu","politik","politik pemilu presiden parlemen kebijakan","Arial","#ffce73",68,6,.15],
 ["Documentary","Narasi dokumenter dengan serif","dokumenter","sejarah arsip museum abad dokumenter","Georgia","#c5e7e0",64,6,.18],
 ["Motivation","Kata dorongan dengan huruf tebal","motivasi","bangkit sukses berani gagal semangat","Verdana","#ffdd44",84,3,.52],
 ["Finance","Sorotan angka dan perbandingan","finance","saham rupiah investasi inflasi persen","Arial","#71efaf",68,4,.2],
 ["Debate","Penekanan argumen dan sanggahan","debat","debat lawan argumen bantah setuju","Verdana","#ff997a",72,4,.43],
 ["Breaking News","Headline ringkas berkontras tinggi","berita","berita laporan terkini peristiwa","Arial","#ff6a73",76,3,.3],
 ["Storytelling","Frasa naratif dengan tempo mengalir","wawancara","cerita pengalaman waktu dulu wawancara","Georgia","#efaaff",74,5,.32],
 ["Tutorial","Petunjuk bertahap yang mudah dibaca","tutorial","langkah cara tutorial belajar edukasi","Verdana","#87d6ff",69,6,.16],
 ["Newsroom","Bulletin studio dengan bilah desk","newsroom","redaksi koresponden bulletin buletin presenter newsroom","Arial","#8cd6ff",66,6,.12],
 ["Horror Story","Bayangan tipis dan ujaran terungkap perlahan","horror","horor horror hantu lorong seram angker","Georgia","#d1b5be",68,5,.21],
 ["Luxury","Komposisi galeri dan serif lapang","luxury","mewah perhiasan luxury butik atelier arloji","Georgia","#e6c687",64,6,.1],
 ["Meme Fast","Stiker reaksi dan caption singkat","meme","meme ngakak kocak receh fail absurd","Verdana","#ecff39",84,2,.47],
 ["Islamic Dakwah","Renungan tenang dengan ornamen geometris","dakwah","dakwah pengajian shalat salat akhlak islam khutbah","Georgia","#bde9cd",68,7,.07],
 ["Edu Explainer","Papan konsep dan penjelasan bertahap","explainer","konsep sains proses definisi rumus fenomena","Verdana","#a9edfe",69,5,.16],
 ["Street Interview","Label pertanyaan lapangan dan caption percakapan","street","warga jalanan voxpop trotoar pejalan responden","Arial","#ffbd64",76,4,.35],
 ["Finance Market","Terminal pasar dan penekanan angka ujaran","market","ihsg indeks emiten bursa trading ticker obligasi","Courier New","#83efcc",66,4,.12],
 ["Tech Review","Panel spesifikasi dan ukuran tabular","tech","ponsel chipset benchmark baterai laptop gawai","Verdana","#b3baff",64,5,.17],
 ["True Crime","Berkas kronologi dan anotasi mesin tik","crime","perkara pengadilan penyelidikan kesaksian forensik kronologi","Courier New","#e7c49e",64,5,.19],
];
export const styles = definitions.map(([name,description,type,terms,font,color,size,words,zoom])=>({
 name:"Clipper "+name,description,type,terms:terms.split(" "),font,color,size,words,zoom,
 ...profiles[type],tempo:words<=3?"cepat":words>=6?"tenang":"sedang",
 palette:[color,"#101417","#ffffff"],useCases:[profiles[type].example],status:"experimental"
}));
// Built-in presets keep the original editing pipeline and its historical settings.
export const builtIns=[
 {name:"Manual",type:"manual",description:"Framing vertikal dengan kontrol editor.",example:"Merapikan rentang potongan yang sudah dipilih sendiri.",rules:["diam","tanpa subtitle otomatis","sesuai durasi sumber","tanpa scene tambahan","kredit dan watermark","video sumber","font kredit pilihan","potong langsung","rentang manual","audio asli"]},
 {name:"Cinematic",type:"cinematic",description:"Framing pembicara dengan gerak halus.",example:"Cuplikan percakapan dengan ilustrasi dokumenter.",rules:["push-in halus","sorotan kata aktif","push-in delapan detik","ilustrasi kontekstual berjarak","subtitle dan kredit","foto dokumenter","font editor","larut","batas ujaran","audio dialog"]},
 {name:"Stack Pop",type:"stack-pop",description:"Kartu foto pilihan dan caption berblok.",example:"Menampilkan koleksi foto yang disebut narasumber.",rules:["kartu bertumpuk","blok kata aktif","kartu tampil tiga detik","siklus kartu sepuluh detik","tumpukan foto dan mosaik","foto pilihan editor","kapital tebal","larut","siklus kartu","audio dialog"]}
].map(preset=>{
 const [animationGrammar,subtitleGrammar,pacingRules,sceneDensityRules,overlayVocabulary,assetBehavior,typographyBehavior,transitionGrammar,cutRhythm,soundCueHints]=preset.rules;
 return {...preset,animationGrammar,subtitleGrammar,pacingRules,sceneDensityRules,overlayVocabulary,assetBehavior,typographyBehavior,transitionGrammar,cutRhythm,soundCueHints,useCases:[preset.example]};
});
export function recommendStyles(text){
 const tokens=new Set(text.toLowerCase().match(/[\p{L}\d]+/gu)||[]);
 return styles.map(style=>{
 const matches=style.terms.filter(t=>tokens.has(t));
 return {name:style.name,type:style.type,score:matches.length+(style.type==="podcast"?.1:0),reason:matches.length?"Kata terkait: "+matches.join(", "):style.description};
 }).sort((a,b)=>b.score-a.score).slice(0,3);
}

export const controlPresets = {
  Clean: {
    controlPreset: "Clean",
    substyle: "Minimal",
    animationIntensity: 0.25,
    visualDensity: 0.2,
    subtitleAnimation: "frasa",
    subtitleSize: 66,
    zoom: 0.2,
    transitionSpeed: 0.8,
    brollFrequency: 0.2,
    collageIntensity: 0,
    motionDensity: 0.2,
    bgmVolume: 0,
    sfxIntensity: 0,
    safeArea: "universal",
  },
  Balanced: {
    controlPreset: "Balanced",
    substyle: "Default",
    animationIntensity: 0.55,
    visualDensity: 0.5,
    subtitleAnimation: "Auto",
    subtitleSize: 70,
    zoom: 0.45,
    transitionSpeed: 1.0,
    brollFrequency: 0.5,
    collageIntensity: 0.4,
    motionDensity: 0.5,
    bgmVolume: 0.06,
    sfxIntensity: 0.25,
    safeArea: "universal",
  },
  Cinematic: {
    controlPreset: "Cinematic",
    substyle: "Editorial",
    animationIntensity: 0.45,
    visualDensity: 0.45,
    subtitleAnimation: "karaoke",
    subtitleSize: 68,
    zoom: 0.55,
    transitionSpeed: 0.75,
    brollFrequency: 0.6,
    collageIntensity: 0.2,
    motionDensity: 0.4,
    bgmVolume: 0.1,
    sfxIntensity: 0.2,
    safeArea: "reels",
  },
  "Highly Visual": {
    controlPreset: "Highly Visual",
    substyle: "Editorial",
    animationIntensity: 0.7,
    visualDensity: 0.85,
    subtitleAnimation: "Auto",
    subtitleSize: 70,
    zoom: 0.5,
    transitionSpeed: 1.15,
    brollFrequency: 0.9,
    collageIntensity: 0.75,
    motionDensity: 0.85,
    bgmVolume: 0.08,
    sfxIntensity: 0.35,
    safeArea: "universal",
  },
  "Viral Dynamic": {
    controlPreset: "Viral Dynamic",
    substyle: "Bold",
    animationIntensity: 0.9,
    visualDensity: 0.8,
    subtitleAnimation: "blok",
    subtitleSize: 78,
    zoom: 0.75,
    transitionSpeed: 1.45,
    brollFrequency: 0.65,
    collageIntensity: 0.7,
    motionDensity: 0.8,
    bgmVolume: 0.08,
    sfxIntensity: 0.55,
    safeArea: "tiktok",
  },
  "Documentary Rich": {
    controlPreset: "Documentary Rich",
    substyle: "Editorial",
    animationIntensity: 0.4,
    visualDensity: 0.7,
    subtitleAnimation: "frasa",
    subtitleSize: 64,
    zoom: 0.35,
    transitionSpeed: 0.8,
    brollFrequency: 0.85,
    collageIntensity: 0.3,
    motionDensity: 0.75,
    bgmVolume: 0.12,
    sfxIntensity: 0.2,
    safeArea: "shorts",
  },
  "Maximum Motion": {
    controlPreset: "Maximum Motion",
    substyle: "Neon",
    animationIntensity: 1.0,
    visualDensity: 0.95,
    subtitleAnimation: "blok",
    subtitleSize: 80,
    zoom: 0.85,
    transitionSpeed: 1.75,
    brollFrequency: 0.8,
    collageIntensity: 0.9,
    motionDensity: 0.95,
    bgmVolume: 0.1,
    sfxIntensity: 0.7,
    safeArea: "tiktok",
  },
};

const clampNum = (v, lo, hi, fb) => (Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Number(v))) : fb);

export function normalizeEditingControls(raw = {}) {
  const base = controlPresets[raw.controlPreset] || controlPresets.Balanced;
  return {
    controlPreset: Object.hasOwn(controlPresets, raw.controlPreset) ? raw.controlPreset : "Balanced",
    substyle: ["Default", "Minimal", "Bold", "Editorial", "Neon"].includes(raw.substyle) ? raw.substyle : base.substyle,
    animationIntensity: clampNum(raw.animationIntensity, 0, 1, base.animationIntensity),
    visualDensity: clampNum(raw.visualDensity, 0, 1, base.visualDensity),
    subtitleAnimation: ["Auto", "blok", "karaoke", "tinta", "angka", "muncul", "frasa", "baris"].includes(raw.subtitleAnimation)
      ? raw.subtitleAnimation
      : base.subtitleAnimation,
    subtitleSize: Math.round(clampNum(raw.subtitleSize, 44, 92, base.subtitleSize)),
    transitionSpeed: clampNum(raw.transitionSpeed, 0.5, 2.0, base.transitionSpeed),
    brollFrequency: clampNum(raw.brollFrequency, 0, 1, base.brollFrequency),
    collageIntensity: clampNum(raw.collageIntensity, 0, 1, base.collageIntensity),
    motionDensity: clampNum(raw.motionDensity, 0, 1, base.motionDensity),
    bgmVolume: clampNum(raw.bgmVolume, 0, 0.5, base.bgmVolume),
    sfxIntensity: clampNum(raw.sfxIntensity, 0, 1, base.sfxIntensity),
    targetDuration: [15, 30, 60].includes(Number(raw.targetDuration)) ? Number(raw.targetDuration) : 30,
    exportQuality: ["preview-360p", "hd-720p", "full-1080p"].includes(raw.exportQuality)
      ? raw.exportQuality
      : raw.preview === true
        ? "preview-360p"
        : "full-1080p",
    safeArea: ["universal", "tiktok", "reels", "shorts"].includes(raw.safeArea) ? raw.safeArea : base.safeArea,
  };
}
