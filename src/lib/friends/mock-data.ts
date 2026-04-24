export type FriendProfile = {
  id: string;
  name: string;
  image: string | null;
  initials: string;
  vertical: string;
  composite: number;
  streak: number;
  totalReps: number;
  weeklyDelta: number;
  strongestDimension: string;
  weakestDimension: string;
  status: "online" | "training" | "offline";
  joinedDaysAgo: number;
  mutualFriends: number;
};

export type FriendActivity = {
  id: string;
  friendId: string;
  friendName: string;
  friendInitials: string;
  type: "workout_complete" | "streak_milestone" | "new_high" | "challenge_win" | "joined";
  description: string;
  timestamp: string;
  value?: number;
};

export type Challenge = {
  id: string;
  challengerName: string;
  challengerInitials: string;
  challengerScore: number | null;
  opponentName: string;
  opponentInitials: string;
  opponentScore: number | null;
  prompt: string;
  status: "pending" | "active" | "completed";
  createdAt: string;
  expiresAt: string;
};

export const MOCK_FRIENDS: FriendProfile[] = [
  {
    id: "f1",
    name: "Sarah Kim",
    image: null,
    initials: "SK",
    vertical: "Sales",
    composite: 94,
    streak: 42,
    totalReps: 187,
    weeklyDelta: 5,
    strongestDimension: "structure",
    weakestDimension: "delivery",
    status: "training",
    joinedDaysAgo: 90,
    mutualFriends: 3,
  },
  {
    id: "f2",
    name: "Varun Patel",
    image: null,
    initials: "VP",
    vertical: "Consulting",
    composite: 92,
    streak: 31,
    totalReps: 142,
    weeklyDelta: 3,
    strongestDimension: "clarity",
    weakestDimension: "adaptability",
    status: "online",
    joinedDaysAgo: 75,
    mutualFriends: 2,
  },
  {
    id: "f3",
    name: "Priya Ramasamy",
    image: null,
    initials: "PR",
    vertical: "Healthcare",
    composite: 89,
    streak: 18,
    totalReps: 96,
    weeklyDelta: -1,
    strongestDimension: "adaptability",
    weakestDimension: "structure",
    status: "offline",
    joinedDaysAgo: 60,
    mutualFriends: 4,
  },
  {
    id: "f4",
    name: "James Liu",
    image: null,
    initials: "JL",
    vertical: "Sales",
    composite: 87,
    streak: 12,
    totalReps: 73,
    weeklyDelta: 7,
    strongestDimension: "thinking_quality",
    weakestDimension: "conciseness",
    status: "online",
    joinedDaysAgo: 45,
    mutualFriends: 1,
  },
  {
    id: "f5",
    name: "Elena Voronova",
    image: null,
    initials: "EV",
    vertical: "Finance",
    composite: 85,
    streak: 22,
    totalReps: 118,
    weeklyDelta: 2,
    strongestDimension: "conciseness",
    weakestDimension: "thinking_quality",
    status: "training",
    joinedDaysAgo: 55,
    mutualFriends: 3,
  },
  {
    id: "f6",
    name: "Marcus Torres",
    image: null,
    initials: "MT",
    vertical: "Leadership",
    composite: 83,
    streak: 9,
    totalReps: 54,
    weeklyDelta: 4,
    strongestDimension: "delivery",
    weakestDimension: "clarity",
    status: "offline",
    joinedDaysAgo: 30,
    mutualFriends: 2,
  },
  {
    id: "f7",
    name: "Aisha Bello",
    image: null,
    initials: "AB",
    vertical: "Law",
    composite: 82,
    streak: 15,
    totalReps: 89,
    weeklyDelta: 1,
    strongestDimension: "structure",
    weakestDimension: "delivery",
    status: "online",
    joinedDaysAgo: 68,
    mutualFriends: 5,
  },
  {
    id: "f8",
    name: "Oliver Strauss",
    image: null,
    initials: "OS",
    vertical: "Consulting",
    composite: 80,
    streak: 7,
    totalReps: 41,
    weeklyDelta: 6,
    strongestDimension: "clarity",
    weakestDimension: "thinking_quality",
    status: "offline",
    joinedDaysAgo: 22,
    mutualFriends: 1,
  },
];

export const MOCK_PENDING_REQUESTS: Pick<FriendProfile, "id" | "name" | "initials" | "vertical" | "composite" | "mutualFriends">[] = [
  { id: "p1", name: "Mei Lin Chen", initials: "MC", vertical: "Education", composite: 79, mutualFriends: 2 },
  { id: "p2", name: "Noah Daniels", initials: "ND", vertical: "Sales", composite: 70, mutualFriends: 1 },
];

export const MOCK_ACTIVITY: FriendActivity[] = [
  {
    id: "a1",
    friendId: "f1",
    friendName: "Sarah Kim",
    friendInitials: "SK",
    type: "workout_complete",
    description: "Completed daily workout — scored 96 composite",
    timestamp: "12 min ago",
    value: 96,
  },
  {
    id: "a2",
    friendId: "f4",
    friendName: "James Liu",
    friendInitials: "JL",
    type: "new_high",
    description: "New personal best — 91 on an Adapt rep",
    timestamp: "38 min ago",
    value: 91,
  },
  {
    id: "a3",
    friendId: "f5",
    friendName: "Elena Voronova",
    friendInitials: "EV",
    type: "streak_milestone",
    description: "Hit a 21-day streak",
    timestamp: "1h ago",
    value: 21,
  },
  {
    id: "a4",
    friendId: "f2",
    friendName: "Varun Patel",
    friendInitials: "VP",
    type: "workout_complete",
    description: "Finished workout — 4 reps, composite up +3 from yesterday",
    timestamp: "2h ago",
  },
  {
    id: "a5",
    friendId: "f7",
    friendName: "Aisha Bello",
    friendInitials: "AB",
    type: "challenge_win",
    description: "Won a challenge vs. Marcus T. — 87 to 83",
    timestamp: "3h ago",
    value: 87,
  },
  {
    id: "a6",
    friendId: "f3",
    friendName: "Priya Ramasamy",
    friendInitials: "PR",
    type: "workout_complete",
    description: "Completed daily workout — scored 88 composite",
    timestamp: "4h ago",
    value: 88,
  },
  {
    id: "a7",
    friendId: "f8",
    friendName: "Oliver Strauss",
    friendInitials: "OS",
    type: "joined",
    description: "Joined Cognify and completed their first workout",
    timestamp: "5h ago",
  },
  {
    id: "a8",
    friendId: "f6",
    friendName: "Marcus Torres",
    friendInitials: "MT",
    type: "new_high",
    description: "New personal best — 89 on a Structure rep",
    timestamp: "6h ago",
    value: 89,
  },
];

export const MOCK_CHALLENGES: Challenge[] = [
  {
    id: "c1",
    challengerName: "You",
    challengerInitials: "MV",
    challengerScore: null,
    opponentName: "Sarah Kim",
    opponentInitials: "SK",
    opponentScore: null,
    prompt: "Pitch a 20% budget increase to your VP",
    status: "active",
    createdAt: "2h ago",
    expiresAt: "22h left",
  },
  {
    id: "c2",
    challengerName: "James Liu",
    challengerInitials: "JL",
    challengerScore: 84,
    opponentName: "You",
    opponentInitials: "MV",
    opponentScore: null,
    prompt: "Explain a product delay to an upset client",
    status: "pending",
    createdAt: "5h ago",
    expiresAt: "19h left",
  },
  {
    id: "c3",
    challengerName: "Aisha Bello",
    challengerInitials: "AB",
    challengerScore: 87,
    opponentName: "Marcus Torres",
    opponentInitials: "MT",
    opponentScore: 83,
    prompt: "Present quarterly results to the board",
    status: "completed",
    createdAt: "1d ago",
    expiresAt: "Finished",
  },
];

export const MOCK_SUGGESTED: Pick<FriendProfile, "id" | "name" | "initials" | "vertical" | "composite" | "mutualFriends">[] = [
  { id: "s1", name: "Sofia Mendes", initials: "SM", vertical: "Consulting", composite: 76, mutualFriends: 3 },
  { id: "s2", name: "Tomás García", initials: "TG", vertical: "Finance", composite: 74, mutualFriends: 2 },
  { id: "s3", name: "Hana Kobayashi", initials: "HK", vertical: "Education", composite: 72, mutualFriends: 4 },
  { id: "s4", name: "Chloe Wright", initials: "CW", vertical: "Healthcare", composite: 68, mutualFriends: 1 },
];
