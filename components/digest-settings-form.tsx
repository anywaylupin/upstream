'use client';

import { SaveIcon, SendIcon } from 'lucide-react';
import { useActionState, useEffect, useId, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { type DigestState, saveDigestSettings, sendDigestNow } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DIGEST_FREQUENCIES,
  type DigestFrequency,
  MAX_DAY_OF_MONTH,
  MAX_INTERVAL_DAYS,
  MIN_INTERVAL_DAYS,
  nextDigestAt,
  WEEKDAYS
} from '@/lib/digest-schedule';
import { TIMEZONE_GROUPS } from '@/lib/timezones';

const initialState: DigestState = {};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MONTH_DAYS = Array.from({ length: MAX_DAY_OF_MONTH }, (_, index) => index + 1);

/**
 * A row of round chips. The weekday ones carry a single letter, so two pairs
 * collide (S/S and T/T) - the tooltip and the aria-label carry the real name.
 */
function Chips({
  legend,
  options,
  value,
  onChange,
  disabled
}: {
  legend: string;
  options: { value: number; chip: string; title: string }[];
  value: number;
  onChange: (next: number) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 font-medium text-sm">{legend}</legend>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Tooltip key={option.value}>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon-sm"
                    variant={active ? 'default' : 'outline'}
                    aria-label={option.title}
                    aria-pressed={active}
                    disabled={disabled}
                    onClick={() => onChange(option.value)}
                    className="rounded-full tabular-nums"
                  />
                }
              >
                {option.chip}
              </TooltipTrigger>
              <TooltipContent>{option.title}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </fieldset>
  );
}

export function DigestSettingsForm({
  email,
  fallbackEmail,
  enabled,
  frequency,
  hour,
  weekday,
  timezone,
  dayOfMonth,
  intervalDays,
  lastDigestAt,
  mailConfigured
}: {
  email: string;
  fallbackEmail: string | null;
  enabled: boolean;
  frequency: DigestFrequency;
  hour: number;
  weekday: number;
  timezone: string;
  dayOfMonth: number;
  intervalDays: number;
  lastDigestAt: string | null;
  mailConfigured: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveDigestSettings, initialState);
  const [sending, startSending] = useTransition();

  const [on, setOn] = useState(enabled);
  const [freq, setFreq] = useState<DigestFrequency>(frequency);
  const [selectedHour, setSelectedHour] = useState(String(hour));
  const [selectedDay, setSelectedDay] = useState(weekday);
  const [zone, setZone] = useState(timezone);
  const [monthDay, setMonthDay] = useState(dayOfMonth);
  const [gap, setGap] = useState(String(intervalDays));
  const emailId = useId();
  const gapId = useId();

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.success) toast.success('Digest settings saved');
  }, [state]);

  // Computed after mount so the server and client never disagree on "now".
  const [preview, setPreview] = useState<string | null>(null);

  const schedule = useMemo(
    () => ({
      enabled: on,
      frequency: freq,
      hour: Number(selectedHour),
      weekday: selectedDay,
      timezone: zone,
      dayOfMonth: monthDay,
      intervalDays: Number(gap) || MIN_INTERVAL_DAYS,
      lastDigestAt: lastDigestAt ? new Date(lastDigestAt) : null
    }),
    [on, freq, selectedHour, selectedDay, zone, monthDay, gap, lastDigestAt]
  );

  useEffect(() => {
    const next = nextDigestAt(schedule);
    setPreview(
      next
        ? next.toLocaleString('en-US', {
            timeZone: schedule.timezone,
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23'
          })
        : null
    );
  }, [schedule]);

  const needsWeekday = freq === 'weekly' || freq === 'biweekly';

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="enabled"
          checked={on}
          onChange={(event) => setOn(event.target.checked)}
          className="mt-0.5 size-4 accent-[var(--primary)]"
        />
        <span className="flex flex-col">
          <span className="font-medium">Send me the digest</span>
          <span className="text-muted-foreground text-xs">
            Off means Upstream keeps tracking releases but never emails you.
          </span>
        </span>
      </label>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={emailId} className="font-medium text-sm">
          Email
        </label>
        <Input
          id={emailId}
          name="email"
          type="email"
          defaultValue={email}
          placeholder={fallbackEmail ?? 'you@example.com'}
          disabled={pending || !on}
          className="max-w-sm"
        />
        <p className="text-muted-foreground text-xs">
          {fallbackEmail ? `Blank uses ${fallbackEmail}.` : 'Blank uses your GitHub email.'}
        </p>
      </div>

      <input type="hidden" name="frequency" value={freq} />
      <input type="hidden" name="hour" value={selectedHour} />
      <input type="hidden" name="weekday" value={selectedDay} />
      <input type="hidden" name="timezone" value={zone} />
      <input type="hidden" name="dayOfMonth" value={monthDay} />
      <input type="hidden" name="intervalDays" value={gap} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="font-medium text-sm">Frequency</span>
          <Select
            value={freq}
            onValueChange={(value) => setFreq(String(value) as DigestFrequency)}
            disabled={!on || pending}
          >
            <SelectTrigger size="sm" className="w-40">
              <SelectValue>
                {(value: string) => DIGEST_FREQUENCIES.find((item) => item.id === value)?.label ?? value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {DIGEST_FREQUENCIES.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="font-medium text-sm">Hour</span>
          <Select value={selectedHour} onValueChange={(value) => setSelectedHour(String(value))} disabled={!on}>
            <SelectTrigger size="sm" className="w-24">
              <SelectValue>{(value: string) => `${value.padStart(2, '0')}:00`}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {String(value).padStart(2, '0')}:00
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="font-medium text-sm">Region</span>
          <Select value={zone} onValueChange={(value) => setZone(String(value))} disabled={!on}>
            <SelectTrigger size="sm" className="w-56">
              <SelectValue>{(value: string) => value.replaceAll('_', ' ')}</SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {TIMEZONE_GROUPS.map((group) => (
                <SelectGroup key={group.region}>
                  <SelectLabel>{group.region}</SelectLabel>
                  {group.zones.map((tz) => (
                    <SelectItem key={tz.id} value={tz.id}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {needsWeekday && (
        <Chips
          legend="Day"
          disabled={!on}
          value={selectedDay}
          onChange={setSelectedDay}
          options={WEEKDAYS.map((day) => ({ value: day.value, chip: day.initial, title: day.label }))}
        />
      )}

      {freq === 'monthly' && (
        <div className="flex flex-col gap-1.5">
          <Chips
            legend="Date"
            disabled={!on}
            value={monthDay}
            onChange={setMonthDay}
            options={MONTH_DAYS.map((day) => ({ value: day, chip: String(day), title: `Day ${day}` }))}
          />
          <p className="text-muted-foreground text-xs">Stops at {MAX_DAY_OF_MONTH} so every month has the date.</p>
        </div>
      )}

      {freq === 'custom' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={gapId} className="font-medium text-sm">
            Every
          </label>
          <div className="flex items-center gap-2">
            <Input
              id={gapId}
              type="number"
              min={MIN_INTERVAL_DAYS}
              max={MAX_INTERVAL_DAYS}
              value={gap}
              onChange={(event) => setGap(event.target.value)}
              disabled={!on}
              className="w-20"
            />
            <span className="text-muted-foreground text-sm">days</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={pending} aria-busy={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
          Save
        </Button>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={sending || !mailConfigured}
                aria-busy={sending}
                onClick={() => {
                  startSending(async () => {
                    const result = await sendDigestNow();
                    if (result.error) toast.error(result.error);
                    else toast.success(result.message ?? 'Digest sent');
                  });
                }}
              />
            }
          >
            {sending ? <Spinner data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}
            Send now
          </TooltipTrigger>
          <TooltipContent>
            {mailConfigured
              ? 'Send the last 7 days now. Does not shift the schedule.'
              : 'Needs RESEND_API_KEY on the server.'}
          </TooltipContent>
        </Tooltip>

        {on && preview && <span className="text-muted-foreground text-xs">Next: {preview}</span>}
      </div>
    </form>
  );
}
