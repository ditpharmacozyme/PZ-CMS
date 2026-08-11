export type BrandId = 'pharmacozyme' | 'pz-academy' | 'med-q' | 'pillz' | 'prescriptionz';

export type UserRole = 'Owner' | 'Manager' | 'Editor' | 'Viewer';

export interface TeamMember {
  id: string;
  name: string;
  role: string; // freeform display role label (e.g. "Creative Director")
  userRole: UserRole; // permission level
  email: string;
  avatarInitials: string;
  color: string; // hex accent color for avatar
  passcode?: string;
}

export type AuditActionType =
  | 'post_created'
  | 'post_edited'
  | 'post_deleted'
  | 'post_approved'
  | 'post_scheduled'
  | 'post_duplicated'
  | 'status_changed'
  | 'member_added'
  | 'member_removed'
  | 'login'
  | 'logout';

export interface AuditEvent {
  id: string;
  actorId: string;
  actorName: string;
  actionType: AuditActionType;
  entityType: 'post' | 'member' | 'template' | 'asset' | 'content_bank' | 'session';
  entityId?: string;
  entityTitle?: string;
  beforeValue?: Record<string, unknown>;
  afterValue?: Record<string, unknown>;
  sessionId?: string;
  timestamp: string; // ISO string
}


export interface BrandConfig {
  id: BrandId;
  name: string;
  shortCode: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  surfaceColor: string;
  icon: string; // Material Symbol name
  logoUrl?: string; // Brand logo image URL
  description: string;
  voiceRules: string[];
  fonts: {
    display: string;
    headline: string;
    code: string;
    body: string;
  };
}

export type PostStatus = 'not-started' | 'in-progress' | 'ready-to-post' | 'posted';

export type Platform = 'instagram' | 'linkedin' | 'twitter' | 'web' | 'email';

export interface ContentBankItem {
  id: string;
  text: string;
  tags: string[];
  source: string;
  savedDate: string;
  brandId: BrandId | 'shared';
}


export type SpecType = 'feed-post' | 'story' | 'reel' | 'carousel' | 'newsletter' | 'bio-report';

export interface SpecConfig {
  id: SpecType;
  name: string;
  dimensions: string;
  aspectRatio: string;
  description: string;
}

export interface PostComment {
  id: string;
  author: string;
  avatarUrl?: string;
  text: string;
  timestamp: string;
}

export interface ActivityLogItem {
  id: string;
  actor: string;
  action: string;
  timestamp: string;
}

export interface Post {
  id: string;
  brandId: BrandId;
  title: string;
  caption: string;
  platform: Platform;
  specType: SpecType;
  scheduledDate: string; // YYYY-MM-DD (Calendar / Email Reminder Date)
  scheduledTime: string; // HH:MM (Email Reminder Time)
  reminderEmail?: string; // Recipient email for Instagram posting reminder
  emailReminderEnabled?: boolean; // Whether email reminder is enabled
  reminderSentAt?: string; // Set once the Apps Script daily trigger has emailed this post — prevents duplicate sends
  status: PostStatus;
  assignees: string[];
  visualUrl: string; // image preview or drive URL
  templateId?: string;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: string;
  recurrenceRule?: string; // e.g. 'weekly:monday' or 'monthly'
  comments: PostComment[];
  activityLog: ActivityLogItem[];
  notes?: string;
  tags: string[];
}

export interface PostTemplate {
  id: string;
  title: string;
  description: string;
  brandId: BrandId | 'shared';
  category: 'Clinical' | 'Interactive' | 'Editorial' | 'Patient-Facing' | 'Internal';
  platform: Platform;
  specType: SpecType;
  defaultCaption: string;
  tags: string[];
  imagePreview: string;
  usesCount: number;
}

export interface BrandAsset {
  id: string;
  brandId: BrandId;
  title: string;
  type: 'logo' | 'font' | 'spec_sheet' | 'vector_pack';
  fileType: string;
  size: string;
  url: string;
}

export interface AppNotification {
  id: string;
  type: 'due_soon' | 'unassigned' | 'collision_alert';
  title: string;
  message: string;
  date: string;
  read: boolean;
  postId?: string;
  brandId?: BrandId;
}
