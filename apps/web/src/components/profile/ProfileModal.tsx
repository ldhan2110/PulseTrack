import { useRef, useState } from 'react';
import { Loader2, Lock, Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/useAuth';
import { api } from '@/lib/api';

function initialsOf(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export function ProfileModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, setUser } = useAuth();
  const isExternal = user?.userType === 'EXTERNAL';

  const [name, setName] = useState(user?.name ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const displayName = name || user.name || user.username || user.email;
  const avatarSrc = preview ?? user.imageUrl ?? undefined;
  const changingPassword = !!(currentPassword || newPassword || confirmPassword);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function handleSave() {
    setError(null);
    if (changingPassword) {
      if (newPassword.length < 8) return setError('New password must be at least 8 characters.');
      if (newPassword !== confirmPassword) return setError('New passwords do not match.');
    }
    setSaving(true);
    try {
      let updated = user!;
      if (file) updated = await api.uploadMyAvatar(file);
      if (name.trim() && name.trim() !== user!.name) {
        updated = await api.updateMyProfile({ name: name.trim() });
      }
      if (changingPassword) {
        await api.changeMyPassword({ currentPassword, newPassword });
      }
      setUser(updated);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
          <DialogDescription>
            {isExternal
              ? 'Update your name, avatar, and password.'
              : 'Your profile is managed by your organization.'}
          </DialogDescription>
        </DialogHeader>

        {!isExternal && (
          <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
            <Lock className="size-4 shrink-0" />
            Managed by SSO — name and avatar sync from your identity provider.
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            {avatarSrc && <AvatarImage src={avatarSrc} alt={displayName} />}
            <AvatarFallback>{initialsOf(displayName)}</AvatarFallback>
          </Avatar>
          <div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={pickFile}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!isExternal || saving}
              onClick={() => fileInput.current?.click()}
            >
              <Upload className="size-4" /> Upload avatar
            </Button>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {isExternal ? 'PNG or JPG, up to 2 MB.' : 'Managed by your identity provider.'}
            </p>
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="profile-name">Display name</Label>
          <Input
            id="profile-name"
            value={name}
            disabled={!isExternal || saving}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={user.email} disabled />
          {isExternal && <p className="text-xs text-muted-foreground">Email can't be changed.</p>}
        </div>

        {isExternal && (
          <>
            <div className="my-1 border-t" />
            <p className="text-sm font-semibold">Change password</p>
            <div className="grid gap-1.5">
              <Label htmlFor="cur-pw">Current password</Label>
              <Input
                id="cur-pw"
                type="password"
                value={currentPassword}
                disabled={saving}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-pw">New password</Label>
              <Input
                id="new-pw"
                type="password"
                value={newPassword}
                disabled={saving}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="confirm-pw">Confirm new password</Label>
              <Input
                id="confirm-pw"
                type="password"
                value={confirmPassword}
                disabled={saving}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            {isExternal ? 'Cancel' : 'Close'}
          </Button>
          {isExternal && (
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
