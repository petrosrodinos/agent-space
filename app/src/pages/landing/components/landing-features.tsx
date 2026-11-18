import type { FC, ReactNode } from "react";
import { CalendarClock, Check, Link2, MousePointer2, Repeat, ShieldCheck } from "lucide-react";
import { LandingBots, LandingMemoryChips, LandingSectionIds } from "@/config/constants/landing/landing.content";
import { BotTile, Reveal, SectionHeading } from "@/pages/landing/components/landing-primitives";
import { cn } from "@/lib/utils";

/** Visual on top and copy below; `horizontal` puts the copy on the left and the visual on the right from lg. */
const FeatureCard: FC<{ title: string; text: string; children: ReactNode; className?: string; delay?: number; horizontal?: boolean }> = ({ title, text, children, className, delay, horizontal = false }) => (
  <Reveal delay={delay} className={cn("group overflow-hidden rounded-2xl border border-hairline bg-surface p-6 shadow-sticker transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-pop sm:p-7", className)}>
    <div className={cn("flex h-full flex-col", horizontal && "lg:flex-row-reverse lg:items-center lg:gap-12")}>
      <div className={cn("flex-1", horizontal && "lg:max-w-[520px]")}>{children}</div>
      <div className={cn(horizontal && "lg:flex-1")}>
        <h3 className={cn("mt-6 text-[19px] font-extrabold tracking-tight text-ink", horizontal && "lg:mt-0 lg:text-[24px]")}>{title}</h3>
        <p className="mt-1.5 text-[15px] leading-relaxed text-body">{text}</p>
      </div>
    </div>
  </Reveal>
);

/** A bot's own browser window, with a cursor gliding across it. */
const CloudComputerVisual: FC = () => (
  <div className="relative overflow-hidden rounded-xl border border-hairline bg-surface-soft">
    <div className="flex items-center gap-1.5 border-b border-hairline px-3 py-2">
      <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
      <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
      <span className="ml-3 flex-1 truncate rounded-full bg-surface-sunken px-3 py-1 text-[11px] font-semibold text-muted-foreground">crm.example.com/deals/acme</span>
      <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-extrabold text-success">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" /> LIVE
      </span>
    </div>
    <div className="grid grid-cols-[1fr_1.4fr] gap-3 p-4">
      <div className="space-y-2">
        {[80, 60, 70, 50].map((w, i) => (
          <div key={i} className={cn("h-2.5 rounded-full", i === 1 ? "bg-tangerine/60" : "bg-surface-sunken")} style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="space-y-2 rounded-lg border border-hairline bg-surface p-3">
        <div className="h-2.5 w-1/2 rounded-full bg-ink/80" />
        <div className="h-2 w-full rounded-full bg-surface-sunken" />
        <div className="h-2 w-5/6 rounded-full bg-surface-sunken" />
        <div className="mt-3 inline-flex h-6 items-center rounded-full bg-primary px-3 text-[10px] font-bold text-primary-foreground">Move to Proposal</div>
      </div>
    </div>
    <MousePointer2 className="absolute left-[62%] top-[68%] h-5 w-5 animate-float fill-ink text-surface drop-shadow" />
    <div className="flex items-center justify-between border-t border-hairline px-3 py-2 text-[11px] font-bold text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <BotTile color={LandingBots.SALES.color} icon={LandingBots.SALES.icon} size={24} /> Sales Sam's computer
      </span>
      <span className="rounded-full border border-hairline-strong px-2.5 py-1 text-ink">Take over</span>
    </div>
  </div>
);

const MemoryVisual: FC = () => (
  <div className="flex flex-col gap-2">
    {LandingMemoryChips.map((m, i) => (
      <span key={m.text} className="inline-flex w-fit items-center gap-2 rounded-full border border-hairline bg-surface-soft px-3 py-1.5 text-[13px] font-semibold text-body transition-transform duration-300 group-hover:translate-x-1" style={{ marginLeft: `${(i % 2) * 18}px`, transitionDelay: `${i * 40}ms` }}>
        <m.icon className="h-3.5 w-3.5 text-muted-foreground" /> {m.text}
      </span>
    ))}
  </div>
);

const TeamVisual: FC = () => (
  <div className="space-y-2.5">
    {[
      { bot: LandingBots.MARKETING, text: "@Researcher what are competitors pricing at?" },
      { bot: LandingBots.RESEARCH, text: "Compared 8. Table's in the thread." },
      { bot: LandingBots.ANALYST, text: "Turned it into a chart for the deck." },
    ].map((m, i) => (
      <div key={i} className="flex items-start gap-2">
        <BotTile color={m.bot.color} icon={m.bot.icon} size={24} />
        <div className="rounded-bubble rounded-tl-xs bg-surface-sunken px-3 py-2 text-[13px] font-medium text-body">{m.text}</div>
      </div>
    ))}
  </div>
);

const ApprovalVisual: FC = () => (
  <div className="rounded-xl border-[1.5px] border-hairline-strong bg-surface p-4 shadow-sticker">
    <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-warning">
      <ShieldCheck className="h-3.5 w-3.5" /> Approval needed
    </div>
    <p className="mt-2 text-[15px] font-bold text-ink">Refund $240 to order #8812</p>
    <p className="text-[12px] font-semibold text-muted-foreground">Stripe – Billing · requested by Ops Otto</p>
    <div className="mt-3 flex gap-2">
      <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-bold text-primary-foreground">
        <Check className="h-3.5 w-3.5" /> Approve
      </span>
      <span className="inline-flex h-8 items-center rounded-full border-[1.5px] border-hairline-strong px-3.5 text-xs font-bold text-ink">Decline</span>
    </div>
  </div>
);

const ArtifactVisual: FC = () => (
  <div className="rounded-xl border border-hairline bg-surface-soft p-4">
    <div className="flex items-center justify-between">
      <span className="text-[13px] font-extrabold text-ink">Q3 pipeline</span>
      <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
        <Link2 className="h-3 w-3" /> Shared
      </span>
    </div>
    <div className="mt-4 flex h-24 items-end gap-2">
      {[
        { h: 45, c: "bg-sky" },
        { h: 70, c: "bg-mint" },
        { h: 55, c: "bg-sunshine" },
        { h: 90, c: "bg-tangerine" },
        { h: 75, c: "bg-bubblegum" },
      ].map((b, i) => (
        <span key={i} className={cn("flex-1 origin-bottom rounded-t-md transition-transform duration-500 group-hover:scale-y-110", b.c)} style={{ height: `${b.h}%`, transitionDelay: `${i * 50}ms` }} />
      ))}
    </div>
  </div>
);

const AutomationVisual: FC = () => (
  <div className="space-y-2">
    {[
      { icon: CalendarClock, when: "Mondays 9:00", what: "Pipeline report to #sales" },
      { icon: Repeat, when: "New lead", what: "Research and draft intro" },
      { icon: CalendarClock, when: "Every evening", what: "Summarise my inbox" },
    ].map((a) => (
      <div key={a.what} className="flex items-center gap-3 rounded-lg border border-hairline bg-surface-soft px-3 py-2.5">
        <a.icon className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">{a.when}</p>
          <p className="truncate text-[13px] font-semibold text-ink">{a.what}</p>
        </div>
        <span className="h-5 w-9 rounded-full bg-primary p-0.5">
          <span className="ml-auto block h-4 w-4 rounded-full bg-primary-foreground" />
        </span>
      </div>
    ))}
  </div>
);

export const LandingFeatures: FC = () => (
  <section id={LandingSectionIds.FEATURES} className="scroll-mt-20 py-24 sm:py-32">
    <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
      <SectionHeading overline="What makes it different" title="A co-worker, not a chatbot." text="Chat-only assistants give advice. Agent Space bots open the tools, click the buttons and finish the job, while you stay in charge." />

      <div className="mt-16 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        <FeatureCard className="lg:col-span-2" title="Bots that act" text="Each bot has its own cloud computer and your real accounts. It browses, fills in forms and updates records. Watch live, or take over with one click.">
          <CloudComputerVisual />
        </FeatureCard>
        <FeatureCard delay={80} title="Bots that know you" text="Memory, company knowledge and reusable skills mean you never explain the same thing twice.">
          <MemoryVisual />
        </FeatureCard>
        <FeatureCard title="Bots that work as a team" text="Add bots and colleagues to one group. Bots consult each other and hand work along.">
          <TeamVisual />
        </FeatureCard>
        <FeatureCard delay={80} title="You stay in control" text="Anything external or hard to undo waits for a clear, previewed approval.">
          <ApprovalVisual />
        </FeatureCard>
        <FeatureCard delay={160} title="Replies you can use" text="Charts, forms, pages and dashboards built right in the chat, each with its own link and versions.">
          <ArtifactVisual />
        </FeatureCard>
        <FeatureCard horizontal className="md:col-span-2 lg:col-span-3" title="Work that runs itself" text="Turn any request into an automation on a schedule or trigger. Long tasks keep going in the background with clear progress.">
          <AutomationVisual />
        </FeatureCard>
      </div>
    </div>
  </section>
);
