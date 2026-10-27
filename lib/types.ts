export type Role = "sneak" | "scoop" | "lookout";
export type Phase = "lobby" | "planning" | "reveal" | "finished";
export type RoofId = "noodle" | "bakery" | "arcade" | "garden";
export type Choice = { roofId: RoofId; role: Role };
export type Roof = { id: RoofId; name: string; subtitle: string; loot: number; capacity: number; color: string };
export type Weather = { id: string; title: string; description: string; roofId: RoofId | null; lootPenalty: number; capacityPenalty: number };
export type PublicPlayer = { id: string; name: string; avatar: number; score: number; bot: boolean; connected: boolean; left?: boolean };
export type RoofResult = {
  roofId: RoofId; noise: number; capacity: number; loot: number; busted: boolean;
  protected: boolean; players: { id: string; role: Role; earned: number; autoPicked?: boolean }[];
  headline: string;
};
export type RoundResult = { round: number; roofs: RoofResult[]; weather: Weather };
export type Reaction = { id: string; playerId: string; emoji: string; at: number };
export type RoomView = {
  code: string; matchId: string; version: number; phase: Phase; round: number; totalRounds: number;
  hostId: string; meId: string; players: PublicPlayer[];
  deadline: number | null; serverTime: number; phaseStartedAt: number;
  roofs: Roof[]; weather: Weather; submittedIds: string[]; myChoice: Choice | null;
  result: RoundResult | null; history: RoundResult[]; practice: boolean;
  reactions: Reaction[];
};
export type RoomAction =
  | { type: "choose"; roofId: RoofId; role: Role; round: number; matchId: string }
  | { type: "start" | "advance" | "rematch" | "add-bot" | "leave" }
  | { type: "remove-player"; targetId: string }
  | { type: "react"; emoji: string };
