import React, {
 createContext,
 useCallback,
 useContext,
 useEffect,
 useMemo,
 useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import {
 UserProfile,
 SubjectChapter,
 Friend,
 SurfaceTheme,
 EnergyMode,
 BazaarItem,
} from '../types';
import {
 INITIAL_CHAPTERS,
 INITIAL_FRIENDS,
} from '../data/mockData';
import {
 generateRandomCodename,
 calculateCheckpointRewards,
} from '../utils/studyLogic';
import { supabase } from '../lib/supabase';

type ProfileUser = UserProfile & { onboardingComplete: boolean };

interface AppContextType {
 user: ProfileUser;
 session: Session | null;
 authLoading: boolean;
 chapters: SubjectChapter[];
 friends: Friend[];
 currentRoute: string;
 isUpdateRequired: boolean;
 activeChapterId: string;
 unbankedUrja: number;
 segmentProgressSec: number;
 sikkaSpin: boolean;
 theme: SurfaceTheme;
 isP2PDrawerOpen: boolean;
 selectedFriendId: string | null;
 activeBattle: {
 isOpen: boolean;
 friendId: string;
 myScore: number;
 friendScore: number;
 questionIndex: number;
 question: string;
 options: string[];
 correctIndex: number;
 } | null;
 settingsCardsOrder: string[];

 navigate: (route: string) => void;
 setIsUpdateRequired: (val: boolean) => void;
 loginUser: (email: string, pass: string) => Promise<boolean>;
 registerUser: (
 name: string,
 username: string,
 email: string,
 password: string,
 ) => Promise<{ success: boolean; message: string }>;
 signOutUser: () => Promise<void>;
 completeOnboarding: (data: Partial<UserProfile>) => void;
 setEnergyMode: (mode: EnergyMode) => void;
 setClassLevel: (lvl: UserProfile['classLevel']) => void;
 openChapterDetails: (id: string) => void;
 startLearningChapter: (id: string) => void;
 startVivaRoom: (id: string) => void;
 leaveLearningPrematurely: () => void;
 confirmEarlyExitPenalty: () => void;
 resumeCurrentSegment: () => void;
 bankUrjaAndContinue: () => void;
 bankUrjaAndLeave: () => void;
 fastForwardCheckpoint: () => void;
 buyAndEquipItem: (item: BazaarItem) => boolean;
 equipItem: (item: BazaarItem) => void;
 addFriendByCodename: (codename: string) => {
 success: boolean;
 message: string;
 };
 openFriendChat: (friendId: string) => void;
 closeFriendChat: () => void;
 sendP2PMessage: (
 friendId: string,
 text?: string,
 imageUrl?: string,
 ) => void;
 startBattleWithFriend: (friendId: string) => void;
 answerBattleQuestion: (index: number) => void;
 closeBattleModal: () => void;
 awardSikka: (amount: number) => void;
 awardUrja: (amount: number) => void;
 reorderSettingsCards: (newOrder: string[]) => void;
 togglePinChapter: (chapterId: string) => void;
 resetChapterProgress: (chapterId: string) => void;
}

const DEFAULT_USER: ProfileUser = {
 realName: '',
 username: '',
 gmail: '',
 isVerified: false,
 schoolName: '',
 classLevel: 'Class 10',
 board: 'CBSE',
 gender: '',
 stream: '',
 dreamCollege: '',
 targetBranch: '',
 language: 'Hinglish',
 interests: [],
 codename: '',
 streak: 0,
 urja: 0,
 sikka: 0,
 baselineScores: {},
 targetDaysLeft: 0,
 weakChapters: [],
 energyMode: 'full',
 equippedItems: {
 upperBodyDrip: '',
 avatarRing: '',
 cardSkin: '',
 streakFlame: '',
 theme: 'pastel',
 },
 purchasedItems: [],
 unlockedBadges: [],
 checkpointsCleared: 0,
 weakZonesFixed: 0,
 battlesWon: 0,
 totalBattles: 0,
 onboardingComplete: false,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const readStorage = <T,>(key: string, fallback: T): T => {
 try {
 const value = localStorage.getItem(key);
 return value ? (JSON.parse(value) as T) : fallback;
 } catch {
 return fallback;
 }
};

const writeStorage = (key: string, value: unknown) => {
 try {
 localStorage.setItem(key, JSON.stringify(value));
 } catch {
 // Storage may be unavailable or full.
 }
};

const profileStorageKey = (id: string) => `studymitra_user_v1:${id}`;

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
 children,
}) => {
 const [session, setSession] = useState<Session | null>(null);
 const [authLoading, setAuthLoading] = useState(true);
 const [user, setUser] = useState<ProfileUser>(DEFAULT_USER);

 const [chapters, setChapters] = useState<SubjectChapter[]>(() =>
 readStorage('studymitra_chapters_v1', INITIAL_CHAPTERS),
 );
 const [friends, setFriends] = useState<Friend[]>(() =>
 readStorage('studymitra_friends_v1', INITIAL_FRIENDS),
 );

 const [currentRoute, setCurrentRoute] = useState('/home');
 const [isUpdateRequired, setIsUpdateRequired] = useState(false);
 const [activeChapterId, setActiveChapterId] = useState('sci-light');
 const [unbankedUrja, setUnbankedUrja] = useState(45);
 const [segmentProgressSec, setSegmentProgressSec] = useState(85);
 const [sikkaSpin, setSikkaSpin] = useState(false);
 const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
 const [isP2PDrawerOpen, setIsP2PDrawerOpen] = useState(false);
 const [settingsCardsOrder, setSettingsCardsOrder] = useState<string[]>([
 'ai-packs',
 'look-feel',
 'multi-ai',
 'storage',
 'mitra-xtra',
 'backup',
 'interface',
 ]);

 const [activeBattle, setActiveBattle] =
 useState<AppContextType['activeBattle']>(null);

 const hydrateProfile = useCallback((authSession: Session | null) => {
 setSession(authSession);

 if (!authSession) {
 setUser(DEFAULT_USER);
 setCurrentRoute('/auth');
 setAuthLoading(false);
 return;
 }

 const id = authSession.user.id;
 const saved = readStorage<Partial<ProfileUser> | null>(
 profileStorageKey(id),
 null,
 );
 const metadata = authSession.user.user_metadata ?? {};

 const hydrated: ProfileUser = {
...DEFAULT_USER,
...saved,
 realName:
 saved?.realName ??
 (typeof metadata.realName === 'string' ? metadata.realName : ''),
 username:
 saved?.username ??
 (typeof metadata.username === 'string' ? metadata.username : ''),
 gmail: authSession.user.email ?? '',
 isVerified: Boolean(authSession.user.email_confirmed_at),
 codename:
 saved?.codename ??
 (typeof metadata.codename === 'string'
 ? metadata.codename
 : generateRandomCodename()),
 onboardingComplete: saved?.onboardingComplete === true,
 };

 setUser(hydrated);
 setCurrentRoute(
 hydrated.onboardingComplete ? '/home' : '/onboarding',
 );
 setAuthLoading(false);
 }, []);

 useEffect(() => {
 let alive = true;

 const {
 data: { subscription },
 } = supabase.auth.onAuthStateChange((_event, nextSession) => {
 if (!alive) return;

 // Defer React updates out of the Supabase auth callback.
 queueMicrotask(() => {
 if (alive) hydrateProfile(nextSession);
 });
 });

 supabase.auth
.getSession()
.then(({ data, error }) => {
 if (!alive) return;
 if (error) {
 hydrateProfile(null);
 return;
 }
 hydrateProfile(data.session);
 })
.catch(() => {
 if (alive) hydrateProfile(null);
 });

 return () => {
 alive = false;
 subscription.unsubscribe();
 };
 }, [hydrateProfile]);

 useEffect(() => {
 if (!session) return;
 writeStorage(profileStorageKey(session.user.id), user);
 }, [session, user]);

 useEffect(() => {
 writeStorage('studymitra_chapters_v1', chapters);
 }, [chapters]);

 useEffect(() => {
 writeStorage('studymitra_friends_v1', friends);
 }, [friends]);

 const navigate = useCallback((route: string) => {
 setCurrentRoute(route);
 }, []);

 const loginUser = useCallback(
 async (email: string, pass: string) => {
 const { error } = await supabase.auth.signInWithPassword({
 email: email.trim(),
 password: pass,
 });

 if (error) return false;
 return true;
 },
 [],
 );

 const registerUser = useCallback(
 async (
 name: string,
 username: string,
 email: string,
 password: string,
 ) => {
 const cleanEmail = email.trim().toLowerCase();
 const codename = generateRandomCodename();

 const { data, error } = await supabase.auth.signUp({
 email: cleanEmail,
 password,
 options: {
 data: {
 realName: name.trim(),
 username: username.trim(),
 codename,
 },
 emailRedirectTo: window.location.origin,
 },
 });

 if (error) {
 return { success: false, message: error.message };
 }

 if (data.session) {
 const nextUser: ProfileUser = {
...DEFAULT_USER,
 realName: name.trim(),
 username: username.trim(),
 gmail: cleanEmail,
 codename,
 isVerified: Boolean(data.user?.email_confirmed_at),
 onboardingComplete: false,
 };
 setUser(nextUser);
 setCurrentRoute('/onboarding');
 return { success: true, message: 'Account created. Continue onboarding.' };
 }

 return {
 success: true,
 message: 'Check your email to confirm your account, then sign in.',
 };
 },
 [],
 );

 const signOutUser = useCallback(async () => {
 await supabase.auth.signOut();
 setSession(null);
 setUser(DEFAULT_USER);
 setCurrentRoute('/auth');
 }, []);

 const completeOnboarding = useCallback(
 (data: Partial<UserProfile>) => {
 setUser((previous) => ({
...previous,
...data,
 onboardingComplete: true,
 }));
 setCurrentRoute('/home');
 },
 [],
 );

 const setEnergyMode = (mode: EnergyMode) => {
 setUser((previous) => ({...previous, energyMode: mode }));
 };

 const setClassLevel = (lvl: UserProfile['classLevel']) => {
 setUser((previous) => ({...previous, classLevel: lvl }));
 };

 const openChapterDetails = (id: string) => setActiveChapterId(id);

 const startLearningChapter = (id: string) => {
 setActiveChapterId(id);
 setSegmentProgressSec(45);
 setUnbankedUrja(30);
 navigate('/learn');
 };

 const startVivaRoom = (id: string) => {
 setActiveChapterId(id);
 navigate('/viva');
 };

 const leaveLearningPrematurely = () => {
 // Warning modal is managed inside /learn.
 };

 const confirmEarlyExitPenalty = () => {
 setUnbankedUrja(0);
 navigate('/home');
 };

 const resumeCurrentSegment = () => {
 // Segment continuation is managed inside /learn.
 };

 const triggerSikkaSpin = () => {
 setSikkaSpin(true);
 window.setTimeout(() => setSikkaSpin(false), 900);
 };

 const awardSikka = (amount: number) => {
 setUser((previous) => ({...previous, sikka: previous.sikka + amount }));
 triggerSikkaSpin();
 };

 const awardUrja = (amount: number) => {
 setUser((previous) => ({...previous, urja: previous.urja + amount }));
 };

 const bankUrjaAndContinue = () => {
 const rewards = calculateCheckpointRewards(user.energyMode);
 setUser((previous) => ({
...previous,
 urja: previous.urja + rewards.urjaEarned,
 sikka: previous.sikka + rewards.sikkaEarned,
 checkpointsCleared: previous.checkpointsCleared + 1,
 }));
 triggerSikkaSpin();
 setUnbankedUrja(0);
 setSegmentProgressSec(0);
 };

 const bankUrjaAndLeave = () => {
 bankUrjaAndContinue();
 navigate('/home');
 };

 const fastForwardCheckpoint = () => setSegmentProgressSec(210);

 const buyAndEquipItem = (item: BazaarItem) => {
 if (user.sikka < item.price) return false;

 setUser((previous) => {
 const equippedItems = {...previous.equippedItems };

 if (item.category === 'drip') equippedItems.upperBodyDrip = item.id;
 if (item.category === 'rings') equippedItems.avatarRing = item.id;
 if (item.category === 'skins') equippedItems.cardSkin = item.id;
 if (item.category === 'flames') equippedItems.streakFlame = item.id;
 if (item.category === 'themes') {
 equippedItems.theme = item.id.replace('theme-', '') as SurfaceTheme;
 }

 return {
...previous,
 sikka: previous.sikka - item.price,
 purchasedItems: [...previous.purchasedItems, item.id],
 equippedItems,
 };
 });

 triggerSikkaSpin();
 return true;
 };

 const equipItem = (item: BazaarItem) => {
 setUser((previous) => {
 const equippedItems = {...previous.equippedItems };

 if (item.category === 'drip') equippedItems.upperBodyDrip = item.id;
 if (item.category === 'rings') equippedItems.avatarRing = item.id;
 if (item.category === 'skins') equippedItems.cardSkin = item.id;
 if (item.category === 'flames') equippedItems.streakFlame = item.id;
 if (item.category === 'themes') {
 equippedItems.theme = item.id.replace('theme-', '') as SurfaceTheme;
 }

 return {...previous, equippedItems };
 });
 };

 const addFriendByCodename = (codename: string) => {
 const clean = codename.trim().toLowerCase();

 if (!clean) {
 return { success: false, message: 'Please enter a valid codename' };
 }
 if (clean === user.codename) {
 return { success: false, message: 'You cannot add your own codename!' };
 }

 const existing = friends.find(
 (friend) => friend.codename.toLowerCase() === clean,
 );
 if (existing) {
 return {
 success: false,
 message: `Friend @${existing.username} already added!`,
 };
 }

 const newFriend: Friend = {
 id: `f-${Date.now()}`,
 codename: clean,
 username: `${clean.split('-')[0]}_star`,
 realName: `${clean.charAt(0).toUpperCase() + clean.slice(1)} Student`,
 rankBadge: 'Gold II',
 streak: 5,
 avatarSeed: clean,
 battlesCount: 0,
 messages: [
 {
 id: `msg-${Date.now()}`,
 sender: 'them',
 text: `Added via Codename ${clean}! Let's study together.`,
 timestamp: 'Just now',
 },
 ],
 };

 setFriends((previous) => [newFriend,...previous]);
 return {
 success: true,
 message: `Connected with ${newFriend.realName} (@${newFriend.username})!`,
 };
 };

 const openFriendChat = (friendId: string) => {
 setSelectedFriendId(friendId);
 setIsP2PDrawerOpen(true);
 };

 const closeFriendChat = () => setIsP2PDrawerOpen(false);

 const sendP2PMessage = (
 friendId: string,
 text?: string,
 imageUrl?: string,
 ) => {
 setFriends((previous) =>
 previous.map((friend) =>
 friend.id !== friendId
 ? friend
 : {
...friend,
 messages: [
...friend.messages,
 {
 id: `msg-${Date.now()}`,
 sender: 'me',
 text,
 imageUrl,
 timestamp: 'Just now',
 },
 ],
 },
 ),
 );
 };

 const startBattleWithFriend = (friendId: string) => {
 setActiveBattle({
 isOpen: true,
 friendId,
 myScore: 50,
 friendScore: 50,
 questionIndex: 0,
 question:
 'Which ray passes through the focus of a concave mirror after reflection?',
 options: [
 'A ray incident parallel to the principal axis',
 'A ray incident passing through the center of curvature',
 'A ray incident obliquely at the pole',
 'A ray passing through the focus before reflection',
 ],
 correctIndex: 0,
 });
 };

 const answerBattleQuestion = (index: number) => {
 if (!activeBattle) return;

 const isCorrect = index === activeBattle.correctIndex;
 const newMyScore = Math.min(
 100,
 Math.max(0, activeBattle.myScore + (isCorrect ? 15 : -10)),
 );

 if (newMyScore >= 95 || newMyScore <= 5) {
 if (newMyScore >= 95) {
 awardUrja(60);
 awardSikka(25);
 setUser((previous) => ({
...previous,
 battlesWon: previous.battlesWon + 1,
 totalBattles: previous.totalBattles + 1,
 }));
 } else {
 setUser((previous) => ({
...previous,
 totalBattles: previous.totalBattles + 1,
 }));
 }
 }

 setActiveBattle((previous) =>
 previous
 ? {
...previous,
 myScore: newMyScore,
 friendScore: 100 - newMyScore,
 questionIndex: previous.questionIndex + 1,
 question:
 previous.questionIndex === 0
 ? 'What is the commercial unit of electrical energy?'
 : 'Which theorem states that a parallel line divides triangle sides in equal ratio?',
 options:
 previous.questionIndex === 0
 ? ['Kilowatt-Hour (1 kWh)', 'Joule-second', 'Volt-Ampere', 'Coulomb']
 : [
 'Basic Proportionality Theorem (BPT)',
 'Pythagoras Theorem',
 'Euler Theorem',
 'Converse of BPT',
 ],
 correctIndex: 0,
 }
 : null,
 );
 };

 const closeBattleModal = () => setActiveBattle(null);

 const reorderSettingsCards = (newOrder: string[]) => {
 setSettingsCardsOrder(newOrder);
 };

 const togglePinChapter = (chapterId: string) => {
 setChapters((previous) =>
 previous.map((chapter) =>
 chapter.id === chapterId
 ? {...chapter, isPinned: !chapter.isPinned }
 : chapter,
 ),
 );
 };

 const resetChapterProgress = (chapterId: string) => {
 setChapters((previous) =>
 previous.map((chapter) =>
 chapter.id === chapterId
 ? {...chapter, accuracy: 0, competencyPct: 0 }
 : chapter,
 ),
 );
 };

 const theme = useMemo(
 () => user.equippedItems.theme,
 [user.equippedItems.theme],
 );

 const value: AppContextType = {
 user,
 session,
 authLoading,
 chapters,
 friends,
 currentRoute,
 isUpdateRequired,
 activeChapterId,
 unbankedUrja,
 segmentProgressSec,
 sikkaSpin,
 theme,
 isP2PDrawerOpen,
 selectedFriendId,
 activeBattle,
 settingsCardsOrder,
 navigate,
 setIsUpdateRequired,
 loginUser,
 registerUser,
 signOutUser,
 completeOnboarding,
 setEnergyMode,
 setClassLevel,
 openChapterDetails,
 startLearningChapter,
 startVivaRoom,
 leaveLearningPrematurely,
 confirmEarlyExitPenalty,
 resumeCurrentSegment,
 bankUrjaAndContinue,
 bankUrjaAndLeave,
 fastForwardCheckpoint,
 buyAndEquipItem,
 equipItem,
 addFriendByCodename,
 openFriendChat,
 closeFriendChat,
 sendP2PMessage,
 startBattleWithFriend,
 answerBattleQuestion,
 closeBattleModal,
 awardSikka,
 awardUrja,
 reorderSettingsCards,
 togglePinChapter,
 resetChapterProgress,
 };

 return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
 const context = useContext(AppContext);
 if (!context) {
 throw new Error('useApp must be used within AppProvider');
 }
 return context;
};
   
