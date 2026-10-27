import { useId } from "react";
import type { PublicPlayer, Role, RoofId, RoundResult } from "../lib/types";

const INK = "#292347";
const COATS = ["#FF9B54", "#8CD6B5", "#B5A2ED", "#F6D775", "#EF8DA9", "#80C5E5", "#E7B282", "#A9C66C", "#DBA1D9", "#E3E8F1"];

/** Original vector mascot. The raincoat changes; the mask always reads as a raccoon. */
export function Raccoon({ avatar = 0, size = 120, className = "", mood = "happy" }: {
  avatar?: number; size?: number; className?: string; mood?: "happy" | "sneaky" | "sad";
}) {
  const coat = COATS[((avatar % COATS.length) + COATS.length) % COATS.length];
  return <svg className={className} width={size} height={size * 1.08} viewBox="0 0 160 174" fill="none" aria-hidden="true">
    <g stroke={INK} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M119 123c22-24 39-17 32 1-5 13-17 25-36 21" fill="#9EABC2" />
      <path d="m138 111 7 17m-21-8 9 19" stroke={INK} strokeWidth="9" />
      <path d="m47 149-5 16c8 7 19 5 23 0l4-13m26 0 3 14c9 5 20 3 23-2l-7-17" fill={INK} />
      <path d="M48 87c-12 14-17 42-13 65 24 9 60 9 88-1 3-24-5-49-17-64Z" fill={coat} />
      <path d="M47 98c-10 1-21 12-23 26 1 7 8 8 13 3l11-12m61-17c11 3 17 13 21 23 1 8-7 11-12 5l-8-10" fill={coat} />
      <path d="M31 124c-3 1-8 5-7 9 3 5 8 5 12 0m87-8c4 0 9 3 8 8-2 5-8 5-12 0" fill="#B8C4D6" />
      <path d="M80 103v48" stroke={INK} strokeOpacity=".4" strokeWidth="2" />
      <path d="m45 130 17 1-1 12c-6 3-12 1-15-2Zm51 1 17-1-1 11c-4 4-11 4-16 2Z" fill="#FFF7D5" fillOpacity=".25" strokeWidth="2" />
      <path d="M40 40 30 16c2-9 16-7 29 5m42 1c11-15 27-17 29-7l-7 26" fill="#9EABC2" />
      <path d="m38 22 7 15 8-11m54 1 9 10 6-16" fill="#E8D6D5" strokeWidth="2" />
      <path d="M31 63c0-31 18-48 48-49 31 0 51 18 51 49v21c-12 18-88 19-100 1Z" fill={coat} />
      <path d="M36 62c2-23 20-35 44-35s43 13 45 35c1 28-21 43-45 43S33 91 36 62Z" fill="#BBC7D8" />
      <path d="M78 34c-7 12-8 29-8 39h21c0-12-2-27-10-39" fill="#E9E9E9" stroke="none" />
      <path d="M40 56c12-11 28-10 35 2l-3 18c-14 9-29 1-32-9m80-12c-12-10-28-9-35 3l3 18c13 8 29 0 32-10" fill={INK} stroke="none" />
      {mood === "sad" ? <g stroke="#FFF7E5" strokeWidth="3">
        <path d="m52 65 10-3m38 0 10 3" />
      </g> : mood === "sneaky" ? <g stroke="#FFF7E5" strokeWidth="3">
        <path d="m52 61 11 4m35 0 11-4" />
      </g> : <g fill="#FFF7E5" stroke="none">
        <ellipse cx="58" cy="64" rx="4" ry="5" /><ellipse cx="103" cy="64" rx="4" ry="5" />
        <circle cx="59" cy="63" r="1.2" fill={INK} /><circle cx="104" cy="63" r="1.2" fill={INK} />
      </g>}
      <path d="M62 83c2-10 13-14 18-14s17 4 18 14c-2 12-32 13-36 0" fill="#F2EEE5" stroke="none" />
      <path d="m74 76 12 0c2 5-2 8-6 8-4 0-8-4-6-8" fill={INK} stroke="none" />
      <path d={mood === "sad" ? "M75 92q5-6 10 0" : "M72 88q8 8 16 0"} strokeWidth="2.5" />
      <path d="m40 83-9 2m10 5-8 4m86-11 10 2m-11 5 8 4" strokeWidth="2" />
      <path d="m57 103 12 9 11-8 11 8 12-9" fill="#FFF7D5" fillOpacity=".35" strokeWidth="2" />
      <circle cx="83" cy="122" r="2" fill={INK} stroke="none" />
    </g>
  </svg>;
}

export function SnackIcon({ size = 28 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M14 8 34 8 38 39Q24 45 10 39Z" fill="#FFB267" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
    <path d="m14 8 3 5 4-4 4 4 4-4 5 4M12 34q13 5 24 0" stroke={INK} strokeWidth="2" />
    <ellipse cx="24" cy="25" rx="8" ry="7" fill="#FFF2BA" transform="rotate(-15 24 25)" />
    <path d="m22 21 5 7m-8-5 5 7m2-10 4 6" stroke="#D98B43" strokeWidth="1.5" />
  </svg>;
}

export function RoleIcon({ role, size = 32 }: { role: Role; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {role === "sneak" && <>
        <path d="M7 24c0-13 34-13 34 0-3 14-13 7-17 4-4 3-14 10-17-4Z" fill="currentColor" fillOpacity=".15" />
        <path d="m13 23 7 2m8 0 7-2M19 36l5 3 5-3" /><path d="M10 13 6 8m32 5 4-5" />
      </>}
      {role === "scoop" && <>
        <path d="M8 21h32l-3 19H11L8 21Z" fill="currentColor" fillOpacity=".15" />
        <path d="m15 22 6-14 10 14M27 11l7-4 6 15M17 28l1 6m6-6v6m7-6-1 6" />
        <path d="m7 14-3-2m37 2 3-2M23 5V2" />
      </>}
      {role === "lookout" && <>
        <path d="m10 20 3-10h8l3 13 3-13h8l3 10" fill="currentColor" fillOpacity=".15" />
        <circle cx="13" cy="29" r="9" fill="currentColor" fillOpacity=".15" />
        <circle cx="35" cy="29" r="9" fill="currentColor" fillOpacity=".15" />
        <path d="M22 27h4m-4 6h4M9 28q1-3 4-3m18 3q1-3 4-3" />
      </>}
    </g>
  </svg>;
}

export function LogoMark({ size = 40 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <path d="M8 25 9 7 25 15Q32 11 39 15L55 7 56 25Q64 47 32 58 0 47 8 25Z" fill="#FF9B54" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
    <path d="M12 28q8-9 19 0l1 8q-14 10-20-8Zm40 0q-8-9-19 0l-1 8q14 10 20-8Z" fill={INK} />
    <ellipse cx="22" cy="31" rx="3" ry="4" fill="#FFF6DB" /><ellipse cx="42" cy="31" rx="3" ry="4" fill="#FFF6DB" />
    <path d="m27 42 10 0-5 6Z" fill={INK} />
  </svg>;
}

function Window({ x, y, wide = false, lit = true }: { x: number; y: number; wide?: boolean; lit?: boolean }) {
  return <g className={lit ? "window-glow" : undefined} transform={`translate(${x} ${y})`}>
    <path d={`M0 0h${wide ? 38 : 25}v37H0Z`} fill={lit ? "#F6D775" : "#484566"} stroke={INK} strokeWidth="3" />
    <path d={`M${wide ? 19 : 12.5} 0v37M0 20h${wide ? 38 : 25}`} stroke={INK} strokeWidth="2.5" />
    {lit && <path d={`M3 3h${wide ? 12 : 6}v14H3Z`} fill="#FFF4C8" opacity=".55" />}
    <path d={`M-3 39h${wide ? 44 : 31}`} stroke="#B5A8C0" strokeWidth="3" />
  </g>;
}

/** The same illustrated landmarks appear on both the skyline and choice cards. */
function Building({ roofId, busted = false }: { roofId: RoofId; busted?: boolean }) {
  const noodle = roofId === "noodle", bakery = roofId === "bakery", arcade = roofId === "arcade";
  const wall = noodle ? "#B47C85" : bakery ? "#D3AB94" : arcade ? "#71638F" : "#678B87";
  return <g strokeLinecap="round" strokeLinejoin="round">
    <path d="M29 91 195 91 195 295 23 295Z" fill={wall} stroke={INK} strokeWidth="4" />
    <path d="M170 93h25v202h-25" fill={INK} opacity=".14" />
    <path d="M27 205h165M27 260h165" stroke={INK} opacity=".13" strokeWidth="3" />
    {noodle && <>
      <path d="M17 99 109 52 207 99 192 113 26 113Z" fill="#5F7581" stroke={INK} strokeWidth="4" />
      <path d="m21 97 88-38 93 38M44 100l66-29 67 29" stroke="#A5CCD0" strokeWidth="3" />
      <path d="M50 106v18m125-18v18" stroke={INK} strokeWidth="3" />
      {[50, 175].map(x => <g key={x} transform={`translate(${x} 128)`}>
        <path d="M-10-3q10-8 20 0v18q-10 8-20 0Z" fill="#F19B65" stroke={INK} strokeWidth="2" />
        <path d="M-5-4v23m10-23v23M0 21v6" stroke="#C35E5B" strokeWidth="2" />
      </g>)}
      <path d="M75 115h70v35H75Z" fill="#FFE4AA" stroke={INK} strokeWidth="3" />
      <path d="M91 132h38q-3 13-19 13-16 0-19-13Z" fill="#CB6661" />
      <path d="m100 127 9-15m3 15 9-15" stroke="#88633C" strokeWidth="2.5" />
      <Window x={46} y={167} /><Window x={92} y={167} lit={!busted} /><Window x={138} y={167} />
      <path d="M42 230h132l9 23H34Z" fill="#F19B65" stroke={INK} strokeWidth="3" />
      {[46, 72, 98, 124, 150].map(x => <path key={x} d={`m${x} 231-5 20h13l2-20`} fill="#FFF0CA" />)}
      <path d="M64 255h95v40H64Z" fill="#F6D775" stroke={INK} strokeWidth="3" />
      <path d="M111 255v40" stroke={INK} strokeWidth="3" />
    </>}
    {bakery && <>
      <path d="M17 99 36 58h141l31 41Z" fill="#9B6780" stroke={INK} strokeWidth="4" />
      <path d="m30 88 164 0M38 75h147" stroke="#D69B9F" strokeWidth="3" />
      <path d="M146 59V29h23v30" fill="#B68187" stroke={INK} strokeWidth="3" />
      <path d="M141 29h33" stroke="#E3B3AE" strokeWidth="5" />
      <path className="cloud-drift" d="M157 17c-13-7 11-13 0-21" fill="none" stroke="#BFE5E7" opacity=".4" strokeWidth="5" />
      <path d="M64 107h92v43H64Z" fill="#FFF0CA" stroke={INK} strokeWidth="3" />
      <path d="M83 138c-14-15 3-26 10-18 10-13 25-12 34 1 13-7 21 10 7 18l-10-6c-9 7-18 6-27 0Z" fill="#E8AA5C" stroke="#9C653E" strokeWidth="2" />
      <path d="m99 119 4 13m11-17 1 18m10-12-3 10" stroke="#9C653E" strokeWidth="2" />
      <Window x={48} y={167} wide /><Window x={125} y={167} wide lit={!busted} />
      <path d="M43 295v-42q0-22 24-22t24 22v42m30 0v-42q0-22 24-22t24 22v42" fill="#F6D775" stroke={INK} strokeWidth="3" />
      <path d="M43 267h48m30 0h48m-102-34v62m78-62v62" stroke={INK} strokeWidth="3" />
      <path d="M47 277q10-16 18 0m6 0q9-16 16 0m38 0q9-16 17 0m6 0q9-16 17 0" fill="#B67E4E" />
    </>}
    {arcade && <>
      <path d="M19 102V76h185v26Z" fill="#9381B3" stroke={INK} strokeWidth="4" />
      <path d="M38 78V38h145v40Z" fill="#433955" stroke={INK} strokeWidth="4" />
      <path d="M47 69V47h126v22Z" fill="none" stroke="#F19CB9" strokeWidth="3" />
      <path d="m68 55 7-6 7 6-7 6Zm33 4V51h13v8m17-7h12m-6-6v12" stroke="#F6D775" strokeWidth="3" fill="none" />
      <path d="M38 112h145v16H38Z" fill="#F19CB9" opacity=".7" />
      <Window x={45} y={147} lit={!busted} /><Window x={95} y={147} lit={!busted} /><Window x={145} y={147} />
      <path d="M49 214h124v81H49Z" fill="#35314F" stroke={INK} strokeWidth="3" />
      {[64, 120].map((x, i) => <g key={x}>
        <path d={`M${x} 291v-30l5-12v-24h34v24l5 12v30Z`} fill={i ? "#C58AAE" : "#76B8B8"} stroke={INK} strokeWidth="3" />
        <path d={`M${x + 10} 232h23v17h-23Z`} fill="#272F43" />
        <path d={`M${x + 16} 241h11m-8-3v6m-9 17h23`} stroke="#F6D775" strokeWidth="2" />
        <circle cx={x + 29} cy={259} r="2" fill="#F6D775" />
      </g>)}
      <path d="M34 204h154" stroke="#F19CB9" strokeWidth="5" />
    </>}
    {!noodle && !bakery && !arcade && <>
      <path d="M17 104V87h187v17Z" fill="#C3BB94" stroke={INK} strokeWidth="4" />
      <path d="M43 88V32m132 56V32M32 36h155M45 23h128" stroke="#535A64" strokeWidth="6" />
      <path d="M53 30q14 18 28 0t28 0 28 0 28 0" stroke="#B7D29C" strokeWidth="4" fill="none" />
      {[57, 105, 158].map((x, i) => <g key={x}>
        <path d={`M${x - 13} 88l-5-22h36l-5 22Z`} fill={i === 1 ? "#ECA777" : "#A6C5B4"} stroke={INK} strokeWidth="2.5" />
        <path d={`M${x} 68V44m0 16q-23 0-17-17 17 0 17 17m0-6q22 0 16-18-16 1-16 18`} fill={i === 1 ? "#7FAC82" : "#8CD6B5"} stroke="#355951" strokeWidth="2" />
      </g>)}
      <Window x={45} y={132} wide /><Window x={125} y={132} wide lit={!busted} />
      <Window x={45} y={209} wide lit={!busted} /><Window x={125} y={209} wide />
      <path d="M24 173h169m-157 0v15h147v-15M42 249h132" stroke={INK} strokeWidth="3" />
      <path d="M179 113c-25 32 15 34-5 61s14 45-5 65 11 40-3 53" stroke="#94B890" strokeWidth="5" fill="none" />
      {[129, 160, 191, 230, 268].map((y, i) => <path key={y} d={`M177 ${y}q${i % 2 ? 18 : -21} -16 ${i % 2 ? 14 : -17} 3-13 7-14-3Z`} fill="#A9CC93" />)}
    </>}
    <path d="M18 295h186" stroke={INK} strokeWidth="5" />
    {busted && <g>
      <path d="M8 17 21 26m180-9-12 9M108 4v15" stroke="#FFB267" strokeWidth="5" />
      <path d="M87 22h42l-4 21H91Z" fill="#FFB267" stroke={INK} strokeWidth="3" />
      <path d="M108 27v7m0 5v1" stroke={INK} strokeWidth="3" />
    </g>}
  </g>;
}

export function RoofIllustration({ roofId, className = "" }: { roofId: RoofId; className?: string }) {
  return <svg viewBox="0 0 220 306" className={className} fill="none" aria-hidden="true">
    <Building roofId={roofId} />
  </svg>;
}

export function CityScene({ className = "", phase = "lobby", round = 1, selectedRoof, results, players = [] }: {
  className?: string; phase?: string; round?: number; selectedRoof?: string; results?: RoundResult | null; players?: PublicPlayer[];
}) {
  const uid = useId().replace(/:/g, "");
  const dawn = phase === "finished";
  const rooftops: { id: RoofId; x: number; y: number }[] = [
    { id: "noodle", x: 45, y: 252 }, { id: "bakery", x: 274, y: 225 },
    { id: "arcade", x: 509, y: 244 }, { id: "garden", x: 744, y: 214 },
  ];
  const compact = phase === "planning" || phase === "reveal";
  return <svg viewBox={compact ? "0 225 1000 350" : "0 0 1000 600"} className={`city-scene ${className}`} fill="none" role="img" aria-labelledby={`${uid}-title`}>
    <title id={`${uid}-title`}>{`${dawn ? "Dawn over" : "A rainy night above"} Noodle House, Moonrise Bakery, the Arcade and Rooftop Garden, with a crew of raincoat raccoons`}</title>
    <defs>
      <linearGradient id={`${uid}-sky`} x1="500" y1="0" x2="500" y2="600" gradientUnits="userSpaceOnUse">
        <stop stopColor={dawn ? "#A69ABF" : "#302B54"} /><stop offset="1" stopColor={dawn ? "#F4B99A" : "#6B718D"} />
      </linearGradient>
      <linearGradient id={`${uid}-street`} x1="500" y1="500" x2="500" y2="600" gradientUnits="userSpaceOnUse">
        <stop stopColor="#47485F" /><stop offset="1" stopColor="#28263E" />
      </linearGradient>
      <radialGradient id={`${uid}-moon`}>
        <stop stopColor="#FFF5CB" stopOpacity=".22" /><stop offset="1" stopColor="#FFF5CB" stopOpacity="0" />
      </radialGradient>
    </defs>
    <path d="M95 14Q490-29 899 29q84 32 95 133v345q0 69-68 77H76q-67-12-69-75V144Q11 48 95 14Z" fill={`url(#${uid}-sky)`} />
    <circle cx="770" cy="108" r="105" fill={`url(#${uid}-moon)`} />
    <path d={dawn ? "M734 129a37 37 0 1 1 74 0Z" : "M787 65a43 43 0 1 0 11 73 39 39 0 0 1-11-73Z"} fill="#F6DDA1" opacity=".9" />
    <g fill="#C5D4DC" opacity=".65">
      {[ [151, 74], [414, 64], [659, 136], [874, 180], [548, 94], [335, 151] ].map(([x, y]) => <path key={x} d={`M${x} ${y - 5}v10m-5-5h10`} stroke="#D6DFD8" strokeWidth="2" />)}
    </g>
    <g className="cloud-drift" fill="#B3C2D3" opacity=".13">
      <path d="M69 127c-7-22 20-37 40-28 12-28 56-24 64 5 22-13 48 1 48 22Z" />
      <path d="M476 152c-4-20 13-34 30-29 6-22 39-27 51-5 23-8 43 8 37 33Z" />
      <path d="M792 168c-6-18 12-33 27-29 17-27 49-20 57 4 24-7 41 9 36 25Z" />
    </g>
    <g fill="#393952" opacity=".57">
      <path d="M8 388V243h65v-20h31v166m91 0V194h41v-25h14v25h26v196m127 0V216h73v-43h16v43h42v175m137 0V193h37v-25h39v222m162 0V260h51v-36h35v164" />
    </g>
    <g opacity=".22" fill="#E8D9AB">
      {[40, 218, 427, 465, 700, 918].flatMap((x, i) => [257, 295, 333].map(y => <path key={`${x}-${y}`} d={`M${x} ${y + i * 3}h9v15h-9Z`} />))}
    </g>
    <g stroke="#BAC9DC" strokeWidth="1.5" opacity={dawn ? .09 : .18}>
      {Array.from({ length: 38 }, (_, i) => {
        const x = 35 + (i * 137) % 930, y = 48 + (i * 83) % 425;
        return <path key={i} className="rain-streak" d={`m${x} ${y} -8 21`} style={{ animationDelay: `${-(i % 9) * .24}s` }} />;
      })}
    </g>
    <path d="M7 510Q498 472 994 511v27q0 46-68 46H76q-67-8-69-74Z" fill={`url(#${uid}-street)`} />
    {rooftops.map(roof => {
      const outcome = results?.roofs.find(r => r.roofId === roof.id);
      const crew = outcome?.players ?? [];
      return <g key={roof.id} className={`city-roof city-roof-${roof.id}${selectedRoof === roof.id ? " is-selected" : ""}`} transform={`translate(${roof.x} ${roof.y})`}>
        {selectedRoof === roof.id && <ellipse cx="110" cy="278" rx="111" ry="18" fill="#F6D775" opacity=".3" />}
        <Building roofId={roof.id} busted={outcome?.busted} />
        {crew.slice(0, 4).map((member, i) => {
          const player = players.find(p => p.id === member.id);
          return <g key={member.id} transform={`translate(${35 + i * 38} ${roof.id === "garden" ? (compact ? 14 : -30) : 1})`} className="raccoon-bob">
            <Raccoon size={48} avatar={player?.avatar ?? i} mood={outcome?.busted ? "sad" : "happy"} />
          </g>;
        })}
        {crew.length > 4 && <g transform={`translate(167 ${compact ? 25 : -15})`}>
          <circle r="16" fill="#FFF2CF" stroke={INK} strokeWidth="2" />
          <text textAnchor="middle" y="5" fill={INK} fontSize="13" fontWeight="800">+{crew.length - 4}</text>
        </g>}
        {outcome && !outcome.busted && crew.length > 0 && [51, 108, 163].map((x, i) => <g key={x} className="loot-spark" transform={`translate(${x} ${compact ? 55 - (i % 2) * 12 : -24 - (i % 2) * 16})`}>
          <SnackIcon size={25} />
        </g>)}
      </g>;
    })}
    <path d="M244 365q19 37 62 8m390-1q32 33 63-6" stroke={INK} strokeWidth="2" />
    <path d="m258 380-5 19 15 4 5-19m435-2-4 17 15 3 4-17" fill="#BFE5E7" stroke="#425068" strokeWidth="2" />
    <g stroke="#BFE5E7" strokeWidth="2" opacity=".25">
      <path d="M51 561h120m37-8h55m429 18h100m-388-3h139m243-23h70" />
      <path d="m78 545 75-3m170 39 88-3m356-23 91-3" />
    </g>
    {!results && phase !== "welcome" && <g transform="translate(399 391)" className="raccoon-bob">
      <Raccoon avatar={(Math.max(1, round) - 1) % COATS.length} size={158} mood={phase === "planning" ? "sneaky" : "happy"} />
      <g transform="translate(115 110) rotate(-10)"><SnackIcon size={43} /></g>
    </g>}
    <g transform="translate(856 527)" stroke={INK} strokeWidth="3">
      <path d="m0 25 7-23h37l5 23Z" fill="#77989D" /><path d="M1 1h48" stroke="#BFE5E7" strokeWidth="5" />
      <path d="M11 12h27" opacity=".5" />
    </g>
  </svg>;
}
