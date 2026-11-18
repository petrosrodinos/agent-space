import type { FC } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LandingBots, LandingControlPoints, LandingNavLinks, LandingPlatforms, LandingSectionIds, LandingSteps, LandingTeamUseCases, LandingTeams } from "@/config/constants/landing/landing.content";
import { BotTile, Reveal, SectionHeading } from "@/pages/landing/components/landing-primitives";
import { LandingLogo, scrollToSection } from "@/pages/landing/components/landing-nav";
import { Routes } from "@/routes/routes";

export const LandingHowItWorks: FC = () => (
  <section id={LandingSectionIds.HOW_IT_WORKS} className="scroll-mt-20 border-y border-hairline bg-surface-soft py-24 sm:py-32">
    <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
      <SectionHeading overline="How it works" title="Your first bot, working in minutes." text="No setup projects, no code. If you can send a message, you can hand off work." />
      <ol className="relative mt-16 grid gap-5 md:grid-cols-3">
        <div aria-hidden className="absolute left-[16%] right-[16%] top-[42px] hidden border-t-2 border-dashed border-hairline-strong md:block" />
        {LandingSteps.map((s, i) => (
          <Reveal key={s.title} delay={i * 100} className="relative">
            <li className="h-full list-none rounded-2xl border border-hairline bg-surface p-7 text-center shadow-sticker">
              <span className="relative mx-auto inline-flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sticker-strong">
                <s.icon className="h-6 w-6" />
                <span className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-sunshine text-[11px] font-extrabold text-[#1C1633]">{i + 1}</span>
              </span>
              <h3 className="mt-5 text-[19px] font-extrabold tracking-tight text-ink">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-body">{s.text}</p>
            </li>
          </Reveal>
        ))}
      </ol>
    </div>
  </section>
);

export const LandingTeamsSection: FC = () => (
  <section id={LandingSectionIds.TEAMS} className="scroll-mt-20 py-24 sm:py-32">
    <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
      <SectionHeading overline="For every team" title="One workspace. A bot for every job." text="Sales, marketing, operations and founders each get co-workers tuned to how they work, sharing the same accounts, skills and knowledge." />
      <Reveal className="mt-12">
        <Tabs defaultValue={LandingTeams.SALES} className="w-full">
          <TabsList className="mx-auto flex h-auto w-fit flex-wrap justify-center gap-1 rounded-full border border-hairline bg-surface-soft p-1">
            {LandingTeamUseCases.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="rounded-full px-4 py-2 text-sm font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sticker">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {LandingTeamUseCases.map((t) => (
            <TabsContent key={t.id} value={t.id} className="mt-10 animate-pop-in">
              <div className="grid items-center gap-8 rounded-2xl border border-hairline bg-surface p-6 shadow-sticker sm:p-10 lg:grid-cols-[0.9fr_1.1fr]">
                <div>
                  <BotTile color={t.bot.color} icon={t.bot.icon} size={56} />
                  <h3 className="mt-5 font-display text-[28px] font-bold leading-tight tracking-[-0.5px] text-ink sm:text-[32px]">{t.headline}</h3>
                  <p className="mt-3 text-[15px] font-semibold text-muted-foreground">Meet {t.bot.name}, one of the bots your team can create.</p>
                </div>
                <div className="space-y-3">
                  {t.prompts.map((p, i) => (
                    <div key={p.ask} className="animate-slide-up rounded-xl border border-hairline bg-surface-soft p-4" style={{ animationDelay: `${i * 90}ms` }}>
                      <p className="ml-auto w-fit max-w-[90%] rounded-bubble rounded-br-xs bg-primary px-3.5 py-2 text-[14px] font-medium text-primary-foreground">{p.ask}</p>
                      <div className="mt-2.5 flex items-center gap-2">
                        <BotTile color={t.bot.color} icon={t.bot.icon} size={24} />
                        <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> {p.done}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </Reveal>
    </div>
  </section>
);

/** Always-dark band: `.dark` on the section switches the design tokens for everything inside it. */
export const LandingControl: FC = () => (
  <section id={LandingSectionIds.CONTROL} className="dark scroll-mt-20 bg-canvas py-24 text-ink sm:py-32">
    <div className="relative mx-auto w-full max-w-[1200px] px-4 sm:px-6">
      <div aria-hidden className="pointer-events-none absolute -top-10 left-1/2 h-64 w-[60%] -translate-x-1/2 rounded-full bg-mint/10 blur-[120px]" />
      <div className="relative grid items-center gap-14 lg:grid-cols-2">
        <SectionHeading align="left" overline="Trust and safety" title="Always visible. Always interruptible." text="Bots act on real accounts, so you see what they do, why, and with which account. Approve, correct, stop or take over at any moment." />
        <div className="grid gap-4 sm:grid-cols-2">
          {LandingControlPoints.map((c, i) => (
            <Reveal key={c.title} delay={i * 80} className="rounded-2xl border border-hairline bg-surface p-6 transition-colors hover:border-hairline-strong">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-surface-elevated text-ink">
                <c.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-[16px] font-extrabold text-ink">{c.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{c.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
      <Reveal className="relative mt-16 flex flex-col items-center justify-between gap-4 rounded-2xl border border-hairline bg-surface-soft px-6 py-5 sm:flex-row">
        <p className="text-[15px] font-semibold text-body">Private by default. Organisation roles for owners, admins and members. Every action recorded.</p>
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-success-soft px-3 py-1.5 text-[13px] font-bold text-success">
          <span className="h-2 w-2 rounded-full bg-mint" /> You're in charge
        </span>
      </Reveal>
    </div>
  </section>
);

export const LandingPlatformsSection: FC = () => (
  <section className="py-24 sm:py-28">
    <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
      <SectionHeading overline="Everywhere you work" title="Same bots on every screen." text="Start a task on your laptop, approve it from your phone. Web, desktop and mobile share the same features and conversations." />
      <div className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-3">
        {LandingPlatforms.map((p, i) => (
          <Reveal key={p.title} delay={i * 80} className="flex flex-col items-center rounded-2xl border border-hairline bg-surface p-6 text-center shadow-sticker">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-surface-sunken text-ink">
              <p.icon className="h-6 w-6" />
            </span>
            <h3 className="mt-4 text-[17px] font-extrabold text-ink">{p.title}</h3>
            <p className="mt-1 text-[14px] text-muted-foreground">{p.text}</p>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

const CTA_BOTS = [LandingBots.SALES, LandingBots.MARKETING, LandingBots.RESEARCH, LandingBots.OPS, LandingBots.ANALYST];

export const LandingFinalCta: FC = () => (
  <section className="px-4 pb-24 sm:px-6 sm:pb-32">
    <Reveal className="relative mx-auto w-full max-w-[1200px] overflow-hidden rounded-[32px] bg-primary px-6 py-16 text-center sm:px-12 sm:py-24">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, var(--primary-foreground) 1px, transparent 0)", backgroundSize: "24px 24px" }} />
      <div className="relative">
        <div className="flex justify-center -space-x-2">
          {CTA_BOTS.map((b, i) => (
            <span key={b.name} className="inline-block animate-float" style={{ animationDelay: `${i * -1.2}s` }}>
              <BotTile color={b.color} icon={b.icon} size={56} className="rounded-xl ring-4 ring-primary" />
            </span>
          ))}
        </div>
        <h2 className="mx-auto mt-8 max-w-3xl font-display text-[38px] font-bold leading-[1.05] tracking-[-1px] text-primary-foreground sm:text-[56px]">Hire your first AI co-worker today.</h2>
        <p className="mx-auto mt-5 max-w-xl text-[17px] text-primary-foreground/75">Create a bot, connect a tool and hand off your first task in under five minutes.</p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="w-full bg-primary-foreground text-primary hover:bg-primary-foreground/90 sm:w-auto">
            <Link to={Routes.auth.sign_up}>
              Get started free <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="w-full text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto">
            <Link to={Routes.auth.sign_in}>I already have an account</Link>
          </Button>
        </div>
      </div>
    </Reveal>
  </section>
);

export const LandingFooter: FC = () => (
  <footer className="border-t border-hairline bg-surface-soft">
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between">
      <div className="max-w-xs">
        <LandingLogo />
        <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">Your team's AI co-workers, connected to your tools and right inside your chats.</p>
      </div>
      <div className="flex gap-16">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[1.2px] text-muted-foreground">Product</p>
          <ul className="mt-3 space-y-2">
            {LandingNavLinks.map((l) => (
              <li key={l.id}>
                <button type="button" onClick={() => scrollToSection(l.id)} className="text-[14px] font-semibold text-body hover:text-ink">
                  {l.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[1.2px] text-muted-foreground">Account</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link to={Routes.auth.sign_in} className="text-[14px] font-semibold text-body hover:text-ink">Sign in</Link>
            </li>
            <li>
              <Link to={Routes.auth.sign_up} className="text-[14px] font-semibold text-body hover:text-ink">Create account</Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
    <div className="border-t border-hairline">
      <p className="mx-auto w-full max-w-[1200px] px-4 py-5 text-[13px] text-muted-foreground sm:px-6">© {new Date().getFullYear()} Agent Space</p>
    </div>
  </footer>
);
