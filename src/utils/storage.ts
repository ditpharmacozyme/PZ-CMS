import { Post, PostTemplate, BrandAsset, AppNotification, ContentBankItem, TeamMember, ResearchItem } from '../types';
import { INITIAL_POSTS, INITIAL_TEMPLATES, INITIAL_ASSETS, INITIAL_NOTIFICATIONS, INITIAL_CONTENT_BANK } from '../data/initialData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const POSTS_KEY = 'pharmacozyme_brandops_posts_v3';
const TEMPLATES_KEY = 'pharmacozyme_brandops_templates_v3';
const ASSETS_KEY = 'pharmacozyme_brandops_assets_v3';
const NOTIFICATIONS_KEY = 'pharmacozyme_brandops_notifs_v3';
const CONTENT_BANK_KEY = 'pharmacozyme_brandops_contentbank_v3';
const RESEARCH_KEY = 'pharmacozyme_brandops_research_v1';
const TEAM_KEY = 'pharmacozyme_brandops_team_v4'; // Bumped to v4 to evict old fictional defaults
const TEAM_KEY_LEGACY = 'pharmacozyme_brandops_team_v3'; // Old key — only used for cleanup

// Default PIN is a generic placeholder, not a real credential — change it per-person in Settings after first login.
const DEFAULT_TEAM_MEMBERS: TeamMember[] = [
  { id: 'tm-1', name: 'Hamza Ansari', role: 'Brand & Content Lead', userRole: 'Owner', email: 'hamzaansari4you@gmail.com', avatarInitials: 'HA', color: '#296c00', passcode: '1234' },
  { id: 'tm-2', name: 'Pharmacozyme Ops', role: 'Global Approver', userRole: 'Manager', email: 'ops@pharmacozyme.com', avatarInitials: 'PO', color: '#0A66C2', passcode: '1234' },
];

// ═══════════════════════════════════════════════════════════════════════
// Local cache (localStorage) — always the fast path. The app reads this on
// first paint so it's never blocked on a network round trip, and every
// mutation writes through it so the app keeps working if Supabase is
// unreachable. See fetchRemote*/upsertRemote* below for the shared layer.
// ═══════════════════════════════════════════════════════════════════════

export function getStoredPosts(): Post[] {
  try {
    const raw = localStorage.getItem(POSTS_KEY);
    if (!raw) {
      saveStoredPosts(INITIAL_POSTS);
      return INITIAL_POSTS;
    }
    const parsed: (Post & { assignee?: string })[] = JSON.parse(raw);
    // Cached posts from before the multi-assignee migration only have `assignee` (string).
    // Normalize so every post has `assignees` before any UI code reads .length/.includes on it.
    return parsed.map((p) => ({
      ...p,
      assignees: p.assignees || (p.assignee ? [p.assignee] : []),
    }));
  } catch (err) {
    console.error('Error reading stored posts:', err);
    return INITIAL_POSTS;
  }
}

export function saveStoredPosts(posts: Post[]): void {
  try {
    localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
  } catch (err) {
    console.error('Error saving posts:', err);
  }
}

export function getStoredTemplates(): PostTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    if (!raw) {
      saveStoredTemplates(INITIAL_TEMPLATES);
      return INITIAL_TEMPLATES;
    }
    return JSON.parse(raw);
  } catch (err) {
    return INITIAL_TEMPLATES;
  }
}

export function saveStoredTemplates(templates: PostTemplate[]): void {
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  } catch (err) {
    console.error('Error saving templates:', err);
  }
}

export function getStoredAssets(): BrandAsset[] {
  try {
    const raw = localStorage.getItem(ASSETS_KEY);
    if (!raw) {
      saveStoredAssets(INITIAL_ASSETS);
      return INITIAL_ASSETS;
    }
    return JSON.parse(raw);
  } catch (err) {
    return INITIAL_ASSETS;
  }
}

export function saveStoredAssets(assets: BrandAsset[]): void {
  try {
    localStorage.setItem(ASSETS_KEY, JSON.stringify(assets));
  } catch (err) {
    console.error('Error saving assets:', err);
  }
}

export function getStoredNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    if (!raw) {
      saveStoredNotifications(INITIAL_NOTIFICATIONS);
      return INITIAL_NOTIFICATIONS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading stored notifications:', err);
    return INITIAL_NOTIFICATIONS;
  }
}

export function saveStoredNotifications(notifs: AppNotification[]): void {
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifs));
  } catch (err) {
    console.error('Error saving notifications:', err);
  }
}

export function getStoredContentBank(): ContentBankItem[] {
  try {
    const raw = localStorage.getItem(CONTENT_BANK_KEY);
    if (!raw) {
      saveStoredContentBank(INITIAL_CONTENT_BANK);
      return INITIAL_CONTENT_BANK;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading stored content bank:', err);
    return INITIAL_CONTENT_BANK;
  }
}

export function saveStoredContentBank(items: ContentBankItem[]): void {
  try {
    localStorage.setItem(CONTENT_BANK_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Error saving content bank:', err);
  }
}

export function getStoredResearchItems(): ResearchItem[] {
  try {
    const raw = localStorage.getItem(RESEARCH_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading stored research items:', err);
    return [];
  }
}

export function saveStoredResearchItems(items: ResearchItem[]): void {
  try {
    localStorage.setItem(RESEARCH_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Error saving research items:', err);
  }
}

// Legacy fictional team members that should be auto-evicted on load
const LEGACY_PHANTOM_NAMES = ['Sarah Jenkins', 'Dr. Alex Vane', 'Marcus Brody', 'Elena Rostova'];

export function resetToDefaults(): void {
  localStorage.removeItem(POSTS_KEY);
  localStorage.removeItem(TEMPLATES_KEY);
  localStorage.removeItem(ASSETS_KEY);
  localStorage.removeItem(NOTIFICATIONS_KEY);
  localStorage.removeItem(CONTENT_BANK_KEY);
  localStorage.removeItem(TEAM_KEY);
  localStorage.removeItem(TEAM_KEY_LEGACY); // Also clear old v3 key
}

export function getStoredTeam(): TeamMember[] {
  try {
    // Clean up old v3 key if it exists
    localStorage.removeItem(TEAM_KEY_LEGACY);

    const raw = localStorage.getItem(TEAM_KEY);
    if (!raw) {
      saveStoredTeam(DEFAULT_TEAM_MEMBERS);
      return DEFAULT_TEAM_MEMBERS;
    }
    const parsed: TeamMember[] = JSON.parse(raw);

    // Migration guard: if stored team only contains old phantom/fictional names, reset to real defaults
    const hasOnlyPhantoms = parsed.every((m) =>
      LEGACY_PHANTOM_NAMES.includes(m.name)
    );
    if (hasOnlyPhantoms && parsed.length > 0) {
      console.info('[Storage] Detected legacy phantom team — resetting to current defaults.');
      saveStoredTeam(DEFAULT_TEAM_MEMBERS);
      return DEFAULT_TEAM_MEMBERS;
    }

    return parsed;
  } catch (err) {
    console.error('Error reading team:', err);
    return DEFAULT_TEAM_MEMBERS;
  }
}

export function saveStoredTeam(members: TeamMember[]): void {
  try {
    localStorage.setItem(TEAM_KEY, JSON.stringify(members));
  } catch (err) {
    console.error('Error saving team:', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Remote layer (Supabase) — the shared store. Every function here is
// best-effort: on any failure (offline, misconfigured project, RLS not
// applied yet) it logs and returns null/no-ops rather than throwing, so a
// flaky connection degrades to local-only instead of breaking the app.
// ═══════════════════════════════════════════════════════════════════════

export { isSupabaseConfigured };

type PostRow = {
  id: string;
  brand_id: string;
  title: string;
  caption: string;
  platform: string;
  spec_type: string;
  scheduled_date: string | null;
  scheduled_time: string;
  reminder_email: string | null;
  email_reminder_enabled: boolean;
  reminder_sent_at: string | null;
  status: string;
  assignees: string[];
  task_roles?: unknown;
  stage_completion?: unknown;
  visual_url: string;
  template_id: string | null;
  approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  recurrence_rule: string | null;
  notes: string | null;
  tags: string[];
  comments: unknown;
  activity_log: unknown;
};

function rowToPost(row: PostRow): Post {
  return {
    id: row.id,
    brandId: row.brand_id as Post['brandId'],
    title: row.title,
    caption: row.caption,
    platform: row.platform as Post['platform'],
    specType: row.spec_type as Post['specType'],
    scheduledDate: row.scheduled_date || '',
    scheduledTime: row.scheduled_time || '',
    reminderEmail: row.reminder_email || undefined,
    emailReminderEnabled: row.email_reminder_enabled,
    reminderSentAt: row.reminder_sent_at || undefined,
    status: row.status as Post['status'],
    assignees: row.assignees || [],
    taskRoles: (row.task_roles as Post['taskRoles']) || undefined,
    stageCompletion: (row.stage_completion as Post['stageCompletion']) || undefined,
    visualUrl: row.visual_url,
    templateId: row.template_id || undefined,
    approved: row.approved,
    approvedBy: row.approved_by || undefined,
    approvedAt: row.approved_at || undefined,
    recurrenceRule: row.recurrence_rule || undefined,
    notes: row.notes || undefined,
    tags: row.tags || [],
    comments: (row.comments as Post['comments']) || [],
    activityLog: (row.activity_log as Post['activityLog']) || []
  };
}

function postToRow(post: Post): PostRow {
  return {
    id: post.id,
    brand_id: post.brandId,
    title: post.title,
    caption: post.caption,
    platform: post.platform,
    spec_type: post.specType,
    scheduled_date: post.scheduledDate || null,
    scheduled_time: post.scheduledTime || '',
    reminder_email: post.reminderEmail || null,
    email_reminder_enabled: !!post.emailReminderEnabled,
    reminder_sent_at: post.reminderSentAt || null,
    status: post.status,
    assignees: post.assignees || [],
    task_roles: post.taskRoles || null,
    stage_completion: post.stageCompletion || null,
    visual_url: post.visualUrl,
    template_id: post.templateId || null,
    approved: post.approved,
    approved_by: post.approvedBy || null,
    approved_at: post.approvedAt || null,
    recurrence_rule: post.recurrenceRule || null,
    notes: post.notes || null,
    tags: post.tags || [],
    comments: post.comments || [],
    activity_log: post.activityLog || []
  };
}

/** Fetch every post from Supabase. Returns null (not []) if the fetch failed. */
export async function fetchRemotePosts(): Promise<Post[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('[Supabase] fetchRemotePosts failed:', error.message);
    return null;
  }
  return (data as PostRow[]).map(rowToPost);
}

/** Upsert one post to Supabase. Fire-and-forget from the caller's perspective. */
export async function upsertRemotePost(post: Post): Promise<{ error: string | null }> {
  if (!supabase) return { error: null };
  const { error } = await supabase.from('posts').upsert(postToRow(post));
  if (error) console.error('[Supabase] upsertRemotePost failed:', error.message);
  return { error: error ? error.message : null };
}

/** Bulk upsert multiple posts to Supabase in a single batch query. */
export async function upsertRemotePosts(posts: Post[]): Promise<{ error: string | null }> {
  if (!supabase || posts.length === 0) return { error: null };
  const rows = posts.map(postToRow);
  const { error } = await supabase.from('posts').upsert(rows);
  if (error) console.error('[Supabase] upsertRemotePosts failed:', error.message);
  return { error: error ? error.message : null };
}

export async function deleteRemotePost(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) console.error('[Supabase] deleteRemotePost failed:', error.message);
}

/**
 * Subscribe to live changes on the posts table. Refetches the full list on
 * any change rather than patching individual rows — simpler to reason about
 * correctly at this data scale (a handful of brands, not millions of rows).
 * Returns an unsubscribe function.
 */
export function subscribeRemotePosts(onChange: (posts: Post[]) => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('posts-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, async () => {
      const posts = await fetchRemotePosts();
      if (posts) onChange(posts);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ─── Templates ───────────────────────────────────────────────────────────
function rowToTemplate(row: any): PostTemplate {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    brandId: row.brand_id,
    category: row.category,
    platform: row.platform,
    specType: row.spec_type,
    defaultCaption: row.default_caption,
    tags: row.tags || [],
    imagePreview: row.image_preview || '',
    usesCount: row.uses_count || 0
  };
}

function templateToRow(t: PostTemplate) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    brand_id: t.brandId,
    category: t.category,
    platform: t.platform,
    spec_type: t.specType,
    default_caption: t.defaultCaption,
    tags: t.tags || [],
    image_preview: t.imagePreview || '',
    uses_count: t.usesCount || 0
  };
}

export async function fetchRemoteTemplates(): Promise<PostTemplate[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('templates').select('*').order('created_at', { ascending: false });
  if (error) { console.error('[Supabase] fetchRemoteTemplates failed:', error.message); return null; }
  return data.map(rowToTemplate);
}

export async function upsertRemoteTemplate(t: PostTemplate): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('templates').upsert(templateToRow(t));
  if (error) console.error('[Supabase] upsertRemoteTemplate failed:', error.message);
}

export async function deleteRemoteTemplate(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('templates').delete().eq('id', id);
  if (error) console.error('[Supabase] deleteRemoteTemplate failed:', error.message);
}

export function subscribeRemoteTemplates(onChange: (templates: PostTemplate[]) => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('templates-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'templates' }, async () => {
      const templates = await fetchRemoteTemplates();
      if (templates) onChange(templates);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ─── Content Bank ────────────────────────────────────────────────────────
function rowToBankItem(row: any): ContentBankItem {
  return { id: row.id, text: row.text, tags: row.tags || [], source: row.source, savedDate: row.saved_date, brandId: row.brand_id };
}

function bankItemToRow(item: ContentBankItem) {
  return { id: item.id, text: item.text, tags: item.tags || [], source: item.source, saved_date: item.savedDate, brand_id: item.brandId };
}

export async function fetchRemoteContentBank(): Promise<ContentBankItem[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('content_bank').select('*').order('saved_date', { ascending: false });
  if (error) { console.error('[Supabase] fetchRemoteContentBank failed:', error.message); return null; }
  return data.map(rowToBankItem);
}

export async function upsertRemoteContentBankItem(item: ContentBankItem): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('content_bank').upsert(bankItemToRow(item));
  if (error) console.error('[Supabase] upsertRemoteContentBankItem failed:', error.message);
}

export async function deleteRemoteContentBankItem(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('content_bank').delete().eq('id', id);
  if (error) console.error('[Supabase] deleteRemoteContentBankItem failed:', error.message);
}

export function subscribeRemoteContentBank(onChange: (items: ContentBankItem[]) => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('content-bank-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'content_bank' }, async () => {
      const items = await fetchRemoteContentBank();
      if (items) onChange(items);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ─── Research & Plans ────────────────────────────────────────────────────
function rowToResearchItem(row: any): ResearchItem {
  return {
    id: row.id,
    brand: row.brand,
    type: row.type,
    title: row.title,
    owner: row.owner,
    itemDate: row.item_date || undefined,
    tags: row.tags || [],
    driveFileId: row.drive_file_id,
    driveViewUrl: row.drive_view_url,
    fileType: row.file_type,
    parsedMetadata: row.parsed_metadata || undefined,
    uploadedBy: row.uploaded_by || undefined,
    createdAt: row.created_at
  };
}

// created_at is deliberately omitted -- it's a DB-side default set once on
// insert, and re-sending it on every edit-upsert would let a stale client
// value clobber the real one.
function researchItemToRow(item: ResearchItem) {
  return {
    id: item.id,
    brand: item.brand,
    type: item.type,
    title: item.title,
    owner: item.owner,
    item_date: item.itemDate || null,
    tags: item.tags || [],
    drive_file_id: item.driveFileId,
    drive_view_url: item.driveViewUrl,
    file_type: item.fileType,
    parsed_metadata: item.parsedMetadata || null,
    uploaded_by: item.uploadedBy || null
  };
}

export async function fetchRemoteResearchItems(): Promise<ResearchItem[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('research_items').select('*').order('created_at', { ascending: false });
  if (error) { console.error('[Supabase] fetchRemoteResearchItems failed:', error.message); return null; }
  return data.map(rowToResearchItem);
}

export async function upsertRemoteResearchItem(item: ResearchItem): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('research_items').upsert(researchItemToRow(item));
  if (error) console.error('[Supabase] upsertRemoteResearchItem failed:', error.message);
}

export async function deleteRemoteResearchItem(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('research_items').delete().eq('id', id);
  if (error) console.error('[Supabase] deleteRemoteResearchItem failed:', error.message);
}

export function subscribeRemoteResearchItems(onChange: (items: ResearchItem[]) => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('research-items-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'research_items' }, async () => {
      const items = await fetchRemoteResearchItems();
      if (items) onChange(items);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ─── Assets ──────────────────────────────────────────────────────────────
function rowToAsset(row: any): BrandAsset {
  return { id: row.id, brandId: row.brand_id, title: row.title, type: row.type, fileType: row.file_type, size: row.size, url: row.url };
}

function assetToRow(a: BrandAsset) {
  return { id: a.id, brand_id: a.brandId, title: a.title, type: a.type, file_type: a.fileType, size: a.size, url: a.url };
}

export async function fetchRemoteAssets(): Promise<BrandAsset[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('assets').select('*');
  if (error) { console.error('[Supabase] fetchRemoteAssets failed:', error.message); return null; }
  return data.map(rowToAsset);
}

export async function upsertRemoteAsset(a: BrandAsset): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('assets').upsert(assetToRow(a));
  if (error) console.error('[Supabase] upsertRemoteAsset failed:', error.message);
}

export async function deleteRemoteAsset(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('assets').delete().eq('id', id);
  if (error) console.error('[Supabase] deleteRemoteAsset failed:', error.message);
}

export function subscribeRemoteAssets(onChange: (assets: BrandAsset[]) => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('assets-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'assets' }, async () => {
      const assets = await fetchRemoteAssets();
      if (assets) onChange(assets);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ─── Team Members ────────────────────────────────────────────────────────
// passcode is deliberately never read from or written to the remote row: team_members
// uses the same open anon-read policy as every other table, so anything stored there
// is effectively public. PINs stay local-only (localStorage) and are merged back onto
// remote snapshots by the caller — see the passcode-preserving merge in App.tsx.
function rowToTeamMember(row: any): TeamMember {
  return { id: row.id, name: row.name, role: row.role, userRole: row.user_role || (row.name === 'Hamza Ansari' ? 'Owner' : 'Editor'), email: row.email, avatarInitials: row.avatar_initials, color: row.color, authUserId: row.auth_user_id || undefined };
}

function teamMemberToRow(m: TeamMember) {
  return { id: m.id, name: m.name, role: m.role, user_role: m.userRole, email: m.email, avatar_initials: m.avatarInitials, color: m.color, auth_user_id: m.authUserId || null };
}

/**
 * Link this team_members row to a real Supabase Auth account (first-login
 * auto-link). Goes through the link_my_team_member RPC (security definer),
 * not a raw update -- team_members writes are role-gated to Owner/Manager
 * (see migration 0009), and at first-login time this exact user has no role
 * yet since their row isn't linked. The RPC derives the auth user id from
 * the caller's own session server-side rather than trusting a client-passed
 * value, and only ever touches the row whose email matches the caller's.
 */
export async function linkTeamMemberAuthUser(teamMemberId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('link_my_team_member', { p_team_member_id: teamMemberId });
  if (error) console.error('[Supabase] link_my_team_member failed:', error.message);
}

export async function fetchRemoteTeam(): Promise<TeamMember[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('team_members').select('*').order('created_at', { ascending: true });
  if (error) { console.error('[Supabase] fetchRemoteTeam failed:', error.message); return null; }
  return data.map(rowToTeamMember);
}

export async function upsertRemoteTeamMember(m: TeamMember): Promise<{ error: string | null }> {
  if (!supabase) return { error: null };
  const { error } = await supabase.from('team_members').upsert(teamMemberToRow(m));
  if (error) console.error('[Supabase] upsertRemoteTeamMember failed:', error.message);
  return { error: error ? error.message : null };
}

/**
 * Owner-only: creates a real Supabase Auth account for a new team member
 * (via /api/team/create-member, which holds the service-role key server-side)
 * and invites them by email to set their own password. Also writes the
 * team_members row -- unlike upsertRemoteTeamMember, the caller must NOT
 * separately upsert the returned member, since the server already saved it.
 */
export async function provisionTeamMemberAccount(payload: {
  name: string;
  email: string;
  role: string;
  color: string;
}): Promise<{ member?: TeamMember; error?: string; code?: string }> {
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { error: 'No active session.' };

  const res = await fetch('/api/team/create-member', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: body.message || 'Failed to create the team member account.', code: body.code };
  }
  return { member: body.teamMember as TeamMember };
}

/**
 * Owner-only: revokes the team member's Supabase Auth account (via
 * /api/team/remove-member, which holds the service-role key server-side)
 * and removes their team_members row. Unlike a raw client-side delete, this
 * ensures a removed person can no longer authenticate at all -- see
 * api/team/remove-member.ts for why that matters.
 */
export async function removeTeamMemberAccount(id: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: null };
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { error: 'No active session.' };

  const res = await fetch('/api/team/remove-member', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: body.message || 'Failed to remove the team member account.' };
  }
  return { error: null };
}

export function subscribeRemoteTeam(onChange: (members: TeamMember[]) => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('team-members-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, async () => {
      const members = await fetchRemoteTeam();
      if (members) onChange(members);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ─── One-time import ─────────────────────────────────────────────────────
/**
 * Push everything currently in this browser's local cache up to Supabase.
 * Deliberately manual (a Settings button), not automatic — if a Supabase
 * project is empty, that's ambiguous ("nobody's added anything yet" vs.
 * "this browser's data hasn't been pushed"), and auto-uploading could let
 * one browser's stale local copy clobber what teammates already entered.
 */
export async function importLocalDataToRemote(): Promise<{
  posts: number; templates: number; assets: number; contentBank: number; team: number; research: number;
}> {
  const posts = getStoredPosts();
  const templates = getStoredTemplates();
  const assets = getStoredAssets();
  const contentBank = getStoredContentBank();
  const team = getStoredTeam();
  const research = getStoredResearchItems();

  await Promise.all([
    ...posts.map(upsertRemotePost),
    ...templates.map(upsertRemoteTemplate),
    ...assets.map(upsertRemoteAsset),
    ...contentBank.map(upsertRemoteContentBankItem),
    ...team.map(upsertRemoteTeamMember),
    ...research.map(upsertRemoteResearchItem)
  ]);

  return {
    posts: posts.length,
    templates: templates.length,
    assets: assets.length,
    contentBank: contentBank.length,
    team: team.length,
    research: research.length
  };
}
