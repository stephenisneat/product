export type PlatformAdminMember = {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
};

export type AdminUserSearchResult = {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  isPlatformAdmin: boolean;
};
