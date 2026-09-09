import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Row user header — mirrors the sidebar user header (AppSidebar). imageUrl is already an absolute URL.
export function UserCell({ user }: { user: { name: string | null; imageUrl: string | null } }) {
  const name = user.name ?? 'Unknown';
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar className="size-6 shrink-0">
        {user.imageUrl && <AvatarImage src={user.imageUrl} alt={name} />}
        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
    </span>
  );
}
