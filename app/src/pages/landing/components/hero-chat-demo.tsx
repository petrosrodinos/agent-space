import { useEffect, useState, type FC } from "react";
import { Check, CheckCircle2, FileSearch, Globe, Mail, Paperclip, Send, ShieldCheck } from "lucide-react";
import { LandingBots } from "@/config/constants/landing/landing.content";
import { BotTile } from "@/pages/landing/components/landing-primitives";
import { cn } from "@/lib/utils";

const SAM = LandingBots.SALES;

const ACTIVITY = [
  { icon: Globe, text: "Searched the web for Acme news" },
  { icon: FileSearch, text: "Read the Acme deal in HubSpot – Sales" },
  { icon: Mail, text: "Drafted the follow-up in Gmail – Sales" },
];

/** How long each beat of the demo stays on screen before the next one appears (ms). */
const BEATS = [900, 1100, 800, 800, 900, 1300, 1500, 1200, 4200];
const LAST_BEAT = BEATS.length - 1;

/** A looping, scripted group chat: a person asks, a bot works step by step, asks for approval and reports back. */
export const HeroChatDemo: FC = () => {
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setBeat(LAST_BEAT);
      return;
    }
    const t = setTimeout(() => setBeat((b) => (b >= LAST_BEAT ? 0 : b + 1)), BEATS[beat]);
    return () => clearTimeout(t);
  }, [beat]);

  const thinking = beat === 1;
  const stepsShown = Math.max(0, Math.min(ACTIVITY.length, beat - 1));
  const working = beat >= 1 && beat < 5;
  const approved = beat >= 7;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-hairline bg-surface shadow-pop">
      <div className="flex items-center justify-between border-b border-hairline bg-surface-soft px-4 py-3">
        <div className="flex items-center gap-3">
          <BotTile color={SAM.color} icon={SAM.icon} size={32} className={cn(working && "animate-pulse-ring")} />
          <div className="leading-tight">
            <p className="text-sm font-extrabold text-ink">Acme deal room</p>
            <p className="text-xs font-semibold text-muted-foreground">{working ? "Sales Sam is working…" : "You, Sales Sam, Researcher"}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-bold text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-mint" /> Live
        </span>
      </div>

      <div className="flex h-[400px] flex-col justify-end gap-3 overflow-hidden px-4 py-4 sm:h-[420px]">
        <div className="ml-auto max-w-[85%] animate-slide-up rounded-bubble rounded-br-xs bg-primary px-3.5 py-2.5 text-[14px] font-medium text-primary-foreground">
          <span className="font-bold opacity-80">@Sales Sam</span> prep my call with Acme and draft a follow-up for Anna
        </div>

        {thinking && (
          <div className="flex items-center gap-2">
            <BotTile color={SAM.color} icon={SAM.icon} size={24} />
            <span className="inline-flex gap-1 rounded-full bg-surface-sunken px-3 py-2">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 animate-dot rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </span>
          </div>
        )}

        {stepsShown > 0 && (
          <div className="flex gap-2">
            <BotTile color={SAM.color} icon={SAM.icon} size={24} />
            <div className="flex flex-1 flex-col gap-2">
              <div className="rounded-lg border border-hairline bg-surface-soft p-2.5">
                {ACTIVITY.slice(0, stepsShown).map((a, i) => {
                  const done = i < stepsShown - 1 || beat >= 5;
                  return (
                    <div key={a.text} className="flex animate-slide-up items-center gap-2 py-1 text-[13px] font-semibold text-body">
                      <a.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="flex-1">{a.text}</span>
                      {done ? <Check className="h-3.5 w-3.5 text-success" /> : <span className="h-3 w-3 animate-spin rounded-full border-2 border-hairline-strong border-t-ink" />}
                    </div>
                  );
                })}
              </div>

              {beat >= 5 && (
                <p className="animate-slide-up text-[14px] font-medium leading-relaxed text-body">
                  Brief's ready: Acme raised a Series B last week and Anna asked about SSO on the last call. Here's the follow-up.
                </p>
              )}

              {beat >= 6 && (
                <div className="animate-pop-in rounded-lg border-[1.5px] border-hairline-strong bg-surface p-3 shadow-sticker">
                  <div className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wide text-warning">
                    <ShieldCheck className="h-3.5 w-3.5" /> Approval needed
                  </div>
                  <p className="mt-1.5 text-[14px] font-bold text-ink">Send email to anna@acme.com</p>
                  <p className="text-[12px] font-semibold text-muted-foreground">Gmail – Sales · "Great talking today, next steps on SSO"</p>
                  <div className="mt-3 flex gap-2">
                    <span className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition-colors", approved ? "bg-success text-white" : "bg-primary text-primary-foreground")}>
                      {approved ? <Check className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                      {approved ? "Approved" : "Send email"}
                    </span>
                    {!approved && <span className="inline-flex h-8 items-center rounded-full border-[1.5px] border-hairline-strong px-3.5 text-xs font-bold text-ink">Edit</span>}
                  </div>
                </div>
              )}

              {beat >= 8 && (
                <p className="flex animate-slide-up items-center gap-1.5 text-[14px] font-semibold text-ink">
                  <CheckCircle2 className="h-4 w-4 text-success" /> Sent the follow-up to Anna (Gmail – Sales).
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-hairline p-3">
        <div className="flex items-center gap-2 rounded-full bg-surface-sunken px-4 py-2.5">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-[14px] font-medium text-muted-soft">Message the group, or type / for a skill</span>
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Send className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
};
