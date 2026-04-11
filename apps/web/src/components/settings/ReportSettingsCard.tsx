import { useState, useEffect } from 'react';
import { FileText, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useReportConfig, useUpsertReportConfig, useServerTimezone } from '@/hooks/useReportConfig';
import { useMembers } from '@/hooks/useMembers';
import { useRoles } from '@/hooks/useRoles';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  projectId: string;
  canManage: boolean;
}

export function ReportSettingsCard({ projectId, canManage }: Props) {
  const { data: config } = useReportConfig(projectId);
  const { data: serverTz } = useServerTimezone(projectId);
  const { data: members } = useMembers(projectId);
  const { data: roles } = useRoles(projectId);
  const upsert = useUpsertReportConfig(projectId);

  const [isActive, setIsActive] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [googleChatEnabled, setGoogleChatEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [showWebhook, setShowWebhook] = useState(false);
  const [recipientMode, setRecipientMode] = useState('all');
  const [recipientRoles, setRecipientRoles] = useState<string[]>([]);
  const [recipientMembers, setRecipientMembers] = useState<string[]>([]);
  const [frequency, setFrequency] = useState('daily');
  const [scheduleDays, setScheduleDays] = useState<number[]>([1]);
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (config && !initialized) {
      setIsActive(config.isActive);
      setEmailEnabled(config.emailEnabled);
      setGoogleChatEnabled(config.googleChatEnabled);
      setWebhookUrl('');
      setRecipientMode(config.recipientMode);
      setRecipientRoles(config.recipientRoles);
      setRecipientMembers(config.recipientMembers);
      setFrequency(config.frequency);
      setScheduleDays(config.scheduleDays);
      setScheduleTime(config.scheduleTime);
      setInitialized(true);
    }
  }, [config, initialized]);

  const toggleDay = (day: number) => {
    setScheduleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  const toggleRole = (roleId: string) => {
    setRecipientRoles((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId],
    );
  };

  const toggleMember = (memberId: string) => {
    setRecipientMembers((prev) =>
      prev.includes(memberId) ? prev.filter((m) => m !== memberId) : [...prev, memberId],
    );
  };

  const handleSave = () => {
    upsert.mutate({
      isActive,
      emailEnabled,
      googleChatEnabled,
      ...(webhookUrl ? { googleChatWebhookUrl: webhookUrl } : {}),
      recipientMode,
      recipientRoles,
      recipientMembers,
      frequency,
      scheduleDays,
      scheduleTime,
    });
    setInitialized(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-blue-500" />
            <CardTitle>Report Settings</CardTitle>
          </div>
          {canManage && (
            <label className="flex items-center gap-2 text-sm">
              <span className={isActive ? 'text-green-500 font-medium' : 'text-muted-foreground'}>
                {isActive ? 'Active' : 'Inactive'}
              </span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={!canManage}
              />
            </label>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Channels */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Channels</Label>

          {/* Email */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
                disabled={!canManage}
              />
              Email
            </label>

            {emailEnabled && (
              <div className="ml-6 space-y-2">
                <Label className="text-xs">Recipients</Label>
                <Select
                  value={recipientMode}
                  onValueChange={setRecipientMode}
                  disabled={!canManage}
                >
                  <SelectTrigger className="max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Members</SelectItem>
                    <SelectItem value="roles">By Roles</SelectItem>
                    <SelectItem value="members">Specific Members</SelectItem>
                  </SelectContent>
                </Select>

                {recipientMode === 'roles' && roles && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {roles.map((role) => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => toggleRole(role.id)}
                        disabled={!canManage}
                        className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                          recipientRoles.includes(role.id)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                        }`}
                      >
                        {role.name}
                      </button>
                    ))}
                  </div>
                )}

                {recipientMode === 'members' && members && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {members.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggleMember(member.id)}
                        disabled={!canManage}
                        className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                          recipientMembers.includes(member.id)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                        }`}
                      >
                        {member.user.name ?? member.user.username}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Google Chat */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={googleChatEnabled}
                onChange={(e) => setGoogleChatEnabled(e.target.checked)}
                disabled={!canManage}
              />
              Google Chat
            </label>

            {googleChatEnabled && (
              <div className="ml-6">
                <Label className="text-xs">Webhook URL</Label>
                <div className="relative mt-1">
                  <Input
                    type={showWebhook ? 'text' : 'password'}
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder={config?.googleChatWebhookUrl || 'https://chat.googleapis.com/v1/spaces/...'}
                    disabled={!canManage}
                    className="pr-10 max-w-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWebhook(!showWebhook)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showWebhook ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Schedule */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Schedule</Label>

          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="space-y-1">
              <Label className="text-xs">Frequency</Label>
              <Select
                value={frequency}
                onValueChange={setFrequency}
                disabled={!canManage}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Time</Label>
              <Input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                disabled={!canManage}
              />
            </div>
          </div>

          {(frequency === 'weekly' || frequency === 'custom') && (
            <div className="space-y-1">
              <Label className="text-xs">
                {frequency === 'weekly' ? 'Day' : 'Days'}
              </Label>
              <div className="flex gap-1">
                {DAYS.map((day, i) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      if (frequency === 'weekly') {
                        setScheduleDays([i]);
                      } else {
                        toggleDay(i);
                      }
                    }}
                    disabled={!canManage}
                    className={`w-10 h-8 text-xs rounded border transition-colors ${
                      scheduleDays.includes(i)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Timezone: {serverTz?.timezone ?? config?.timezone ?? 'Loading...'}
          </p>
        </div>

        {canManage && (
          <Button
            onClick={handleSave}
            disabled={upsert.isPending}
            size="sm"
          >
            {upsert.isPending ? 'Saving...' : 'Save Report Settings'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
