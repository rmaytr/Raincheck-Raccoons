"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, Check, Copy, Crown, DoorOpen, HelpCircle, Moon, Shield, Volume2, VolumeX, X, CloudRain, WifiOff, Sparkles } from "lucide-react";
import { CityScene, LogoMark, Raccoon, RoleIcon, RoofIllustration, SnackIcon } from "../components/Art";
import { playSound } from "../lib/audio";
import type { Choice, Role, RoomAction, RoomView } from "../lib/types";

const ROLES: { id: Role; name: string; detail: string; note: string }[] = [
  { id: "sneak", name: "Sneak", detail: "1 noise · 1 share", note: "Quiet paws. Can collect solo." },
  { id: "scoop", name: "Scoop", detail: "2 noise · 2 shares", note: "A bigger cut. A louder entrance." },
  { id: "lookout", name: "Lookout", detail: "0 noise · 1 share", note: "+2 cover. Needs a collector." },
];
const REACTIONS = ["✨", "🦝", "☔", "🍜", "💛", "👏"];
function save(key: string, value: string) { try { localStorage.setItem(key, value); } catch {} }
function read(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
async function api(path: string, body?: unknown): Promise<RoomView> {
  const response = await fetch(path, { method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store", headers: body === undefined ? {} : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12000) });
  const result: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(typeof result === "object" && result && "error" in result && typeof result.error === "string" ? result.error : "The rooftops are busy. Please try again.", response.status);
  return result as RoomView;
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]') || []).filter(el => el.getClientRects().length > 0);
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = overflow; previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={ref}><button className="icon-button modal-close" onClick={onClose} aria-label="Close dialog"><X size={22} /></button><h2 id="modal-title">{title}</h2>{children}</div></div>;
}
export default function Home() {
  const [room, setRoom] = useState<RoomView | null>(null);
  const roomRef = useRef<RoomView | null>(null);
  const generation = useRef(0);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(0);
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"create" | "join">("create");
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const [restoreCode, setRestoreCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [sound, setSound] = useState(false);
  const [help, setHelp] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState<Choice>({ roofId: "noodle", role: "sneak" });
  const [now, setNow] = useState(Date.now());
  const offset = useRef(0);
  const closeHelp = useCallback(() => setHelp(false), []);
  const closeLeave = useCallback(() => setLeaving(false), []);
  const receive = useCallback((next: RoomView, requestGeneration: number) => {
    if (requestGeneration !== generation.current) return;
    const previous = roomRef.current;
    if (previous?.code === next.code && next.version < previous.version) return;
    offset.current = next.serverTime - Date.now();
    roomRef.current = next; setRoom(next); setOffline(false); save("raincheck-room", next.code);
  }, []);
  useEffect(() => {
    setName(read("raincheck-name") || "");
    const savedAvatar = Number(read("raincheck-avatar") || 0);
    setAvatar(Number.isInteger(savedAvatar) && savedAvatar >= 0 && savedAvatar < 8 ? savedAvatar : 0);
    setSound(read("raincheck-sound") === "on");
    const invited = new URLSearchParams(location.search).get("room")?.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    const saved = read("raincheck-room");
    if (invited) { setCode(invited); setMode("join"); }
    const restore = invited && invited !== saved ? null : saved;
    const requestGeneration = generation.current;
    if (restore) api(`/api/rooms/${restore}`).then(next => receive(next, requestGeneration)).catch(e => {
      if (e instanceof ApiError && [401, 403, 404, 410].includes(e.status)) save("raincheck-room", "");
      else { setRestoreCode(restore); setError("Your saved crew is temporarily unreachable. Retry to recover your seat."); }
    }).finally(() => setBooting(false));
    else setBooting(false);
  }, [receive]);
  useEffect(() => {
    if (!room?.code) return;
    let stopped = false;
    const requestGeneration = generation.current;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try { const next = await api(`/api/rooms/${room!.code}`); if (!stopped) receive(next, requestGeneration); }
      catch (e) {
        if (stopped || requestGeneration !== generation.current) return;
        if (e instanceof ApiError && [401, 403, 404, 410].includes(e.status)) {
          generation.current++; setError(e.message); roomRef.current = null; setRoom(null); save("raincheck-room", ""); return;
        }
        setOffline(true);
      }
      if (!stopped && requestGeneration === generation.current) timer = setTimeout(poll, document.hidden ? 4000 : roomRef.current?.phase === "lobby" ? 1400 : 900);
    }
    timer = setTimeout(poll, 900);
    return () => { stopped = true; clearTimeout(timer); };
  }, [room?.code, receive]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!help && !leaving) window.scrollTo({ top: 0, behavior: "instant" });
    if (room?.phase === "planning") setDraft(room.myChoice || { roofId: "noodle", role: "sneak" });
    if (room?.phase === "reveal") playSound("reveal", sound);
    if (room?.phase === "finished") playSound("win", sound);
    // A polling revision must not reset a player's uncommitted draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.code, room?.phase, room?.round]);
  async function enter(practice = false) {
    const nickname = name.trim() || (practice ? "Pocket Bandit" : "");
    if (!nickname) { setError("Give your raccoon a nickname first."); document.getElementById("nickname")?.focus(); return; }
    if (!practice && mode === "join" && code.length !== 6) { setError("Enter the six-character room code your friend shared."); return; }
    setBusy(true); setError(""); setRestoreCode(null);
    const requestGeneration = ++generation.current;
    try {
      setName(nickname); save("raincheck-name", nickname); save("raincheck-avatar", String(avatar));
      receive(await api(!practice && mode === "join" ? `/api/rooms/${code}/join` : "/api/rooms", !practice && mode === "join" ? { name: nickname, avatar } : { name: nickname, avatar, practice }), requestGeneration);
      playSound("join", sound);
      history.replaceState(null, "", `?room=${roomRef.current?.code}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not enter. Please try again."); }
    finally { setBusy(false); }
  }
  async function act(action: RoomAction) {
    if (!room || busy) return;
    setBusy(true); setError("");
    const requestGeneration = generation.current;
    try {
      const next = await api(`/api/rooms/${room.code}/actions`, action);
      if (requestGeneration !== generation.current) return;
      if (action.type === "leave") { generation.current++; roomRef.current = null; setRoom(null); save("raincheck-room", ""); history.replaceState(null, "", "/"); setLeaving(false); }
      else receive(next, requestGeneration);
      if (action.type === "choose") playSound("lock", sound);
    } catch (e) { setError(e instanceof Error ? e.message : "That did not land. Please try again."); }
    finally { setBusy(false); }
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2200); }
    catch { setError(`Copy this invitation: ${text}`); }
  }
  const me = room?.players.find(p => p.id === room.meId);
  const isHost = room?.hostId === room?.meId;
  const seconds = room?.deadline ? Math.max(0, Math.ceil((room.deadline - now - offset.current) / 1000)) : 0;
  const players = room?.players.filter(p => !p.left) || [];
  const ranked = [...(room?.players || [])].sort((a, b) => b.score - a.score);
  const winners = ranked.filter(p => p.score === ranked[0]?.score);
  const picked = room?.myChoice || draft;
  const chosenRoof = room?.roofs.find(r => r.id === picked.roofId);
  const weatherHere = room?.weather.roofId === picked.roofId;
  const effectiveLoot = chosenRoof ? chosenRoof.loot - (weatherHere && picked.role !== "lookout" ? room!.weather.lootPenalty : 0) : 0;
  const effectiveLimit = chosenRoof ? chosenRoof.capacity + (picked.role === "lookout" ? 2 : -(weatherHere ? room!.weather.capacityPenalty : 0)) : 0;
  const myResult = room?.result?.roofs.flatMap(r => r.players).find(p => p.id === room.meId);
  const invite = () => `${location.origin}/?room=${room?.code}`;
  return <div className={`app ${room?.phase === "finished" ? "is-dawn" : ""} ${room?.phase === "planning" ? "is-planning" : ""}`}>
    <a className="skip-link" href="#main">Skip to game</a>
    <header className="topbar"><a className="brand" href="/" onClick={e => { if (room) { e.preventDefault(); setLeaving(true); } }} aria-label="Raincheck Raccoons home"><LogoMark size={42} /><span>RAINCHECK<span>RACCOONS</span></span></a><div className="header-actions">{room && <span className="room-label">ROOM <b>{room.code}</b></span>}<button className="icon-button" onClick={() => { setSound(!sound); save("raincheck-sound", !sound ? "on" : "off"); playSound("select", !sound); }} aria-label={sound ? "Mute sound" : "Enable sound"} aria-pressed={sound}>{sound ? <Volume2 size={20} /> : <VolumeX size={20} />}</button><button className="help-button" aria-label="How to play" onClick={() => setHelp(true)}><HelpCircle size={18} /><span>How to play</span></button>{room && <button className="icon-button" onClick={() => setLeaving(true)} aria-label="Leave room"><DoorOpen size={20} /></button>}</div></header>
    {error && <div className="notice error" role="alert"><span>{error}</span>{restoreCode && <button className="button secondary" disabled={busy} onClick={async () => { setBusy(true); const requestGeneration = generation.current; try { receive(await api(`/api/rooms/${restoreCode}`), requestGeneration); setRestoreCode(null); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Still reconnecting. Please retry."); if (e instanceof ApiError && [401, 403, 404, 410].includes(e.status)) { save("raincheck-room", ""); setRestoreCode(null); } } finally { setBusy(false); } }}>Retry saved room</button>}<button className="icon-button" onClick={() => setError("")} aria-label="Dismiss message"><X size={18} /></button></div>}
    {offline && <div className="notice" role="status"><WifiOff size={20} /> Reconnecting to your crew… Your seat is saved.</div>}
    <main id="main">
      <div className="sr-only" aria-live="polite">{room ? room.phase === "planning" ? `Raid ${room.round}. Choose a rooftop and a role, then lock your plan.` : room.phase === "reveal" ? `Raid ${room.round} results. You earned ${myResult?.earned || 0} snacks.` : room.phase === "finished" ? "The night is over. Final scores are ready." : "You are in the lobby." : ""}</div>
      {!room ? <div className="welcome">
        <section className="hero-copy"><div className="eyebrow"><span className="live-dot" /> A LITTLE MISCHIEF. A LOT OF FRIENDS.</div><h1>Raincheck<br /><span>Raccoons<span className="title-star">✦</span></span></h1><p className="hero-description">The city is asleep.<br />Your snack heist is just getting started.</p><p className="hero-sub">Pick a rooftop. Plan your move. Try not to wake the neighbors.</p><div className="game-facts"><span>2–10 players</span><i /><span>5 minutes</span><i /><span>Any device</span></div>
          <div className="entry-card"><div className="entry-tabs" role="group" aria-label="Enter a game"><button aria-pressed={mode === "create"} onClick={() => setMode("create")}>Start a crew</button><button aria-pressed={mode === "join"} onClick={() => setMode("join")}>Join friends</button></div><form onSubmit={e => { e.preventDefault(); void enter(); }}><div className="identity-row"><div className="chosen-avatar"><Raccoon avatar={avatar} size={64} /></div><label htmlFor="nickname">YOUR ALIAS<input id="nickname" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Captain Crumbs" maxLength={18} autoComplete="nickname" required /></label></div><div className="avatars" aria-label="Choose raincoat">{Array.from({ length: 8 }, (_, i) => <button type="button" className={avatar === i ? "active" : ""} aria-label={`Raincoat ${i + 1}`} aria-pressed={avatar === i} onClick={() => { setAvatar(i); playSound("select", sound); }} key={i}><Raccoon avatar={i} size={35} /></button>)}</div>{mode === "join" && <label className="code-input-label" htmlFor="room-code">ROOM CODE<input id="room-code" value={code} maxLength={6} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="ABCDEF" autoCapitalize="characters" autoComplete="off" required /></label>}<button className="button primary full" disabled={busy || booting} type="submit">{busy ? "Finding your rooftop…" : booting ? "Checking your raincoat…" : mode === "create" ? "Make a room" : "Join the crew"}<ArrowRight size={21} /></button></form><button className="practice-button" disabled={busy || booting} onClick={() => void enter(true)}>Flying solo? <b>Try a practice night</b><ArrowRight size={16} /></button><p className="tiny">No accounts. No downloads. Just questionable plans.</p></div>
        </section><section className="hero-art" aria-label="A rainy city full of raccoon mischief"><div className="moon-note">OPEN LATE.<br />SNEAK QUIETLY.</div><CityScene phase="welcome" /><div className="hero-mascot"><Raccoon avatar={avatar} size={176} className="raccoon-bob" /><div className="speech-bubble">I brought the bags.<br /><b>You bring the friends.</b></div></div><span className="art-caption">SIX RAIDS UNTIL SUNRISE</span></section>
        <section className="how-strip"><div><span>01</span><h3>Pick your spot</h3><p>Four rooftops. Different snacks.<br />Everyone chooses in secret.</p></div><div><span>02</span><h3>Play your part</h3><p>Sneak, scoop, or keep lookout.<br />A little teamwork goes a long way.</p></div><div><span>03</span><h3>Share the spoils</h3><p>Too much noise? Nobody eats.<br />Most snacks at sunrise wins.</p></div></section>
      </div> : <div className="game-shell">
        {room.phase === "lobby" ? <><section className="lobby-heading"><div><p className="eyebrow">YOUR MIDNIGHT CREW</p><h1>Good friends.<br /><em>Bad alibis.</em></h1><p>Send your friends the invite. The rooftops are waiting.</p></div><div className="invite-card"><span className="eyebrow">ROOM CODE</span><strong>{room.code}</strong><button className="button secondary" onClick={() => void copy(invite())}>{copied ? <Check size={18} /> : <Copy size={18} />}{copied ? "Invite copied!" : "Copy invite link"}</button></div></section><div className="lobby-layout"><section className="crew-panel"><div className="section-heading"><h2>The usual suspects</h2><span>{players.length}/10</span></div><div className="crew-list">{players.map(p => <div className="crew-member" key={p.id}><Raccoon avatar={p.avatar} size={59} /><div><b>{p.name} {p.id === room.meId && <small>(you)</small>}</b><span>{p.bot ? "Practice bot" : p.id === room.hostId ? "Crew captain" : p.connected ? "Ready for mischief" : "Reconnecting…"}</span></div>{p.id === room.hostId && <Crown size={20} />}{isHost && p.id !== room.meId && <button className="icon-button" disabled={busy} aria-label={`Remove ${p.name}`} onClick={() => void act({ type: "remove-player", targetId: p.id })}><X size={18} /></button>}</div>)}</div>{isHost && <button className="button ghost full" disabled={busy || players.length >= 10} onClick={() => void act({ type: "add-bot" })}>+ Add a practice bot</button>}<p className="small muted">2 players to start · 4+ for maximum mischief</p>{isHost ? <button className="button primary full" disabled={busy || players.length < 2} onClick={() => void act({ type: "start" })}>Let the night begin<ArrowRight size={20} /></button> : <div className="waiting-note"><span className="live-dot" /> Waiting for the captain to start</div>}</section><div className="lobby-city"><CityScene phase="lobby" /><div className="tip"><Shield size={24} /><p><b>A crew, not a team.</b> You share each rooftop’s snacks, but only the biggest stash wins. Trust your friends… selectively.</p></div></div></div></> : <>
          <section className="game-heading"><div><div className="eyebrow">{room.practice ? "PRACTICE NIGHT · 3 BOTS" : "MIDNIGHT MISCHIEF"}<span className="raid-dots" aria-label={`Raid ${room.round} of 6`}>{Array.from({ length: 6 }, (_, i) => <i key={i} className={i < room.round ? "lit" : ""} />)}</span></div><h1>{room.phase === "planning" ? "Where to, troublemaker?" : room.phase === "reveal" ? "So that was the plan." : "The crumbs have settled."}</h1></div>{room.phase !== "finished" && <div className={`timer ${seconds <= 8 ? "urgent" : ""}`} aria-label={`${seconds} seconds remaining`}><span>{room.phase === "planning" ? "LOCK IN" : "NEXT RAID"}</span><strong>{seconds}<small>s</small></strong></div>}</section>
          {room.phase === "finished" ? <section className="finale"><div className="winner-art">{winners.slice(0, 3).map(p => <Raccoon key={p.id} avatar={p.avatar} size={140} className="raccoon-bob" />)}<span className="winner-crown">✦</span></div><p className="eyebrow">THE {winners.length > 1 ? "SHARED" : "UNQUESTIONED"} SNACK ROYALTY</p><h2>{winners.map(p => p.name).join(" & ")}</h2><p className="winner-score"><SnackIcon size={32} />{ranked[0]?.score || 0}<span>snacks, zero regrets</span></p><div className="final-standings">{ranked.map((p, i) => <div key={p.id} className={p.id === room.meId ? "you" : ""}><span>{p.score === ranked[0].score ? <Crown size={18} /> : i + 1}</span><Raccoon avatar={p.avatar} size={42} /><b>{p.name}{p.bot ? " · bot" : p.id === room.meId ? " · you" : ""}</b><strong>{p.score}</strong></div>)}</div><div className="finale-actions">{isHost ? <button className="button primary" disabled={busy} onClick={() => void act({ type: "rematch" })}>One more night?<ArrowRight size={20} /></button> : <p>Waiting for your captain to start a rematch.</p>}<button className="button secondary" onClick={() => void copy(`We raided the rooftops in Raincheck Raccoons! ${winners.map(p => p.name).join(" & ")} won with ${ranked[0]?.score} snacks. Play: ${location.origin}`)}>{copied ? <Check size={18} /> : <Copy size={18} />}{copied ? "Copied!" : "Share the story"}</button></div><details className="night-recap"><summary>Your night, raid by raid</summary><div>{room.history.map(r => { const own = r.roofs.find(x => x.players.some(p => p.id === room.meId)); const player = own?.players.find(p => p.id === room.meId); return <p key={r.round}><span>Raid {r.round} · {room.roofs.find(x => x.id === own?.roofId)?.name || "Away"}</span><b>{player?.earned || 0} snacks{own?.busted ? " · busted!" : ""}</b></p>; })}</div></details></section> : <>
            <div className="forecast"><CloudRain size={28} /><div><b>{room.weather.title}</b><span>{room.weather.description}</span></div><span className="forecast-round">RAID {room.round} / 6</span></div>
            <div className="play-layout"><section className="board"><div className="board-city"><CityScene phase={room.phase} round={room.round} selectedRoof={picked.roofId} results={room.result} players={room.players} /></div>
              {room.phase === "planning" ? <><div className="section-heading"><h2><span className="step">1</span> Choose a rooftop</h2><span>30s to pick · timeout auto-picks</span></div><div className="roofs">{room.roofs.map(roof => { const affected = room.weather.roofId === roof.id; const limit = roof.capacity - (affected ? room.weather.capacityPenalty : 0); const loot = roof.loot - (affected ? room.weather.lootPenalty : 0); return <button key={roof.id} className={`roof-card ${picked.roofId === roof.id ? "selected" : ""}`} style={{ "--roof-color": roof.color } as CSSProperties} disabled={!!room.myChoice || busy} onClick={() => { setDraft({ ...draft, roofId: roof.id }); playSound("select", sound); }} aria-pressed={picked.roofId === roof.id}><div className="roof-art"><RoofIllustration roofId={roof.id} /></div><span className="roof-name">{roof.name}</span><span className="roof-stats"><b><SnackIcon size={18} />{loot}</b><span>Noise ≤ {limit}</span></span>{affected && <span className="weather-tag">Weather affected</span>}{picked.roofId === roof.id && <span className="selection-check"><Check size={14} /></span>}</button>; })}</div><div className="section-heading role-heading"><h2><span className="step">2</span> Pick your part</h2><span>More shares ≠ more friends</span></div><div className="roles">{ROLES.map(role => <button className={`role-card ${picked.role === role.id ? "selected" : ""}`} key={role.id} disabled={!!room.myChoice || busy} onClick={() => { setDraft({ ...draft, role: role.id }); playSound("select", sound); }} aria-pressed={picked.role === role.id}><RoleIcon role={role.id} size={36} /><div><b>{role.name}</b><strong>{role.detail}</strong><span>{role.note}</span></div>{picked.role === role.id && <Check size={17} />}</button>)}</div><div className="lock-bar"><div><b>{room.myChoice ? "Paws off. Your plan is locked." : `${seconds}s · ${ROLES.find(r => r.id === picked.role)?.name} at ${room.roofs.find(r => r.id === picked.roofId)?.name}`}</b><span>{room.myChoice ? "Watch who’s ready. The reveal is coming…" : picked.role === "lookout" ? `Your cover: ${effectiveLoot} snacks · limit ${effectiveLimit}. Needs a collector.` : `${effectiveLoot} snacks · limit ${effectiveLimit} before any lookout. Over = zero.`}</span></div><button className="button primary" disabled={busy || !!room.myChoice || offline} onClick={() => void act({ type: "choose", ...draft, round: room.round, matchId: room.matchId })}>{room.myChoice ? <><Check size={20} />Locked in</> : <>Lock my plan<ArrowRight size={20} /></>}</button></div></> : <>
                <div className={`personal-result ${myResult?.earned ? "success" : ""}`} role="status"><Raccoon avatar={me?.avatar} size={64} mood={myResult?.earned ? "happy" : "sad"} /><div><span>{myResult?.autoPicked ? "YOU WERE GIVEN AN AUTO-PICK" : "YOUR MIDNIGHT HAUL"}</span><h2>{myResult?.earned ? `+${myResult.earned} snacks. Nicely done.` : "No snacks. Still a great raincoat."}</h2></div></div><div className="results-grid">{room.result?.roofs.map(result => <article key={result.roofId} className={`result-card ${result.busted ? "busted" : ""}`}><div className="result-title"><h3>{room.roofs.find(r => r.id === result.roofId)?.name}</h3><span>{result.busted ? "BUSTED!" : result.players.length ? "QUIET ENOUGH" : "ALL QUIET"}</span></div><p>{result.headline}</p><div className="noise-meter"><span style={{ width: `${Math.min(100, result.noise / Math.max(1, result.capacity) * 100)}%` }} /></div><div className="result-meta"><span>Noise {result.noise} / {result.capacity}</span><span>{result.protected ? "Lookout cover +2" : `${result.loot} snacks`}</span></div><div className="result-crew">{result.players.map(p => { const player = room.players.find(x => x.id === p.id); return <div key={p.id}><Raccoon avatar={player?.avatar} size={35} /><span>{player?.name}<small>{p.role}{p.autoPicked ? " · auto" : ""}</small></span><b>+{p.earned}</b></div>; })}{!result.players.length && <span className="muted small">Not a paw in sight.</span>}</div></article>)}</div><div className="next-row"><p>{room.round === 6 ? "Sunrise is coming…" : "Another roof. Another questionable idea."}</p>{isHost && <button className="button secondary" disabled={busy || now + offset.current - room.phaseStartedAt < 3000} onClick={() => void act({ type: "advance" })}>{room.round === 6 ? "See the winners" : "Next raid"}<ArrowRight size={18} /></button>}</div></>}
            </section><aside className="scoreboard"><div className="section-heading"><h2>The crew</h2><span>{room.phase === "planning" ? `${room.submittedIds.length}/${players.length} locked` : "Snack count"}</span></div>{ranked.map(p => <div className={`score-row ${p.id === room.meId ? "you" : ""}`} key={p.id}><Raccoon avatar={p.avatar} size={42} /><div><b>{p.name}{p.id === room.meId ? " (you)" : ""}</b><span>{p.left ? "Left the crew" : p.bot ? "Practice bot" : !p.connected ? "Reconnecting" : room.submittedIds.includes(p.id) ? "Plan locked" : "Plotting…"}</span></div><strong>{p.score}</strong>{room.phase === "planning" && room.submittedIds.includes(p.id) && <Check size={14} className="ready-check" />}</div>)}<div className="crew-tip"><Moon size={18} /><p>Big stashes draw a crowd. Sometimes the quiet roof is the clever roof.</p></div><div className="reactions" aria-label="Send a reaction">{REACTIONS.map(emoji => <button key={emoji} disabled={busy} aria-label={`React ${emoji}`} onClick={() => void act({ type: "react", emoji })}>{emoji}</button>)}</div><div className="reaction-feed" aria-live="polite">{room.reactions.filter(r => room.serverTime - r.at < 6000).slice(-3).map(r => <span key={r.id}>{r.emoji} {room.players.find(p => p.id === r.playerId)?.name}</span>)}</div></aside></div>
          </>}
        </>}
      </div>}
    </main><footer><span>Little paws. Big plans.</span><span>Made for friends, rain or shine.<Sparkles size={14} /></span></footer>
    {help && <Modal title="A good night for a bad idea." onClose={closeHelp}><p className="modal-intro">Collect the most snacks over six rooftop raids. Everyone picks in secret, then all plans are revealed together.</p><ol className="rules-list"><li><b>Pick a rooftop.</b> Each has a snack stash and a noise limit. Weather changes the displayed numbers.</li><li><b>Choose your part.</b> Sneak makes 1 noise for 1 share. Scoop makes 2 noise for 2 shares. Lookout makes no noise for 1 share.</li><li><b>Stay quiet.</b> Add everyone’s noise on your roof. Over the limit? The whole crew gets zero. Equal to the limit is safe.</li><li><b>Split the stash.</b> Safe crews divide snacks by shares, rounded down. Scoop gets twice a Sneak’s share.</li></ol><div className="rule-callout"><Shield size={28} /><div><b>The lookout’s little catch</b><p>A lookout adds 2 to the noise limit and cancels weather penalties. Extra lookouts don’t add extra cover. At least one Sneak or Scoop must collect; an all-lookout roof gets nothing.</p></div></div><p className="rules-example"><b>For example:</b> 20 snacks, a Sneak, a Scoop, and a Lookout. Noise is 3; shares are 1 + 2 + 1. If safe, they earn 5, 10, and 5 snacks.</p><p className="small muted">Plans can’t change once locked. Run out of time? You get a disclosed auto-pick. Nobody is eliminated. Tied winners share the crown. Practice uses three labeled bots.</p><button className="button primary full" onClick={closeHelp}>Got it. Let’s make mischief.<ArrowRight size={20} /></button></Modal>}
    {leaving && <Modal title="Calling it a night?" onClose={closeLeave}><p>Your crew can keep playing. If you’re the captain, another player will take over.</p><div className="dialog-actions"><button className="button secondary" onClick={closeLeave}>Stay with the crew</button><button className="button primary" disabled={busy} onClick={() => void act({ type: "leave" })}>Leave room</button></div></Modal>}
  </div>;
}
