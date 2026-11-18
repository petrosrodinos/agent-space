import type { FC } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingBots, LandingIntegrations, LandingSectionIds } from "@/config/constants/landing/landing.content";
import { HeroChatDemo } from "@/pages/landing/components/hero-chat-demo";
import { BotTile } from "@/pages/landing/components/landing-primitives";
import { scrollToSection } from "@/pages/landing/components/landing-nav";
import { Routes } from "@/routes/routes";

const HERO_BOTS = [LandingBots.SALES, LandingBots.MARKETING, LandingBots.RESEARCH, LandingBots.OPS, LandingBots.ANALYST];

export const LandingHero: FC = () => (
  <section className="relative overflow-hidden">
    {/* Soft dotted floor + bot-colour glows behind the hero. */}
    <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.55] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, var(--hairline-strong) 1px, transparent 0)", backgroundSize: "26px 26px" }} />
    <div aria-hidden className="pointer-events-none absolute -left-32 top-24 h-80 w-80 rounded-full bg-tangerine/20 blur-[100px]" />
    <div aria-hidden className="pointer-events-none absolute -right-24 top-40 h-96 w-96 rounded-full bg-sky/20 blur-[110px]" />
    <div aria-hidden className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-bubblegum/10 blur-[100px]" />

    <div className="relative mx-auto grid w-full max-w-[1200px] items-center gap-14 px-4 pb-20 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:pb-28 lg:pt-20">
      <div className="text-center lg:text-left">
        <div className="inline-flex animate-pop-in items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1.5 shadow-sticker">
          <span className="inline-flex -space-x-1.5">
            {HERO_BOTS.slice(0, 3).map((b) => (
              <BotTile key={b.name} color={b.color} icon={b.icon} size={24} className="rounded-full ring-2 ring-surface" />
            ))}
          </span>
          <span className="text-[13px] font-bold text-body">AI co-workers for your whole team</span>
        </div>

        <h1 className="mt-6 animate-slide-up text-balance font-display text-[44px] font-bold leading-[1.02] tracking-[-1.5px] text-ink sm:text-[58px] lg:text-[54px] xl:text-[64px]">
          Bots that don't just talk.
          <span className="relative mt-1 block">
            They{" "}
            <span className="relative inline-block">
              do the work
              <svg aria-hidden viewBox="0 0 300 18" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-3 w-full text-tangerine">
                <path d="M3 12 C 70 3, 150 3, 297 9" stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none" />
              </svg>
            </span>
            .
          </span>
        </h1>

        <p className="mx-auto mt-7 max-w-xl animate-slide-up text-[17px] leading-relaxed text-body [animation-delay:80ms] sm:text-[18px] lg:mx-0">
          Agent Space gives your team AI co-workers that connect to the tools you already use, work on their own cloud computers and chat with you right where work happens. They always ask before anything important.
        </p>

        <div className="mt-9 flex animate-slide-up flex-col items-center gap-3 [animation-delay:140ms] sm:flex-row sm:justify-center lg:justify-start">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link to={Routes.auth.sign_up}>
              Create your first bot <ArrowRight />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="w-full sm:w-auto" onClick={() => scrollToSection(LandingSectionIds.HOW_IT_WORKS)}>
            See how it works
          </Button>
        </div>
        <p className="mt-4 text-[13px] font-semibold text-muted-foreground">Free to start · First task done in under 5 minutes</p>
      </div>

      <div className="relative mx-auto w-full max-w-[520px] animate-pop-in [animation-delay:120ms]">
        <HeroChatDemo />
        <div className="absolute -bottom-12 -left-16 z-10 hidden w-[230px] animate-float rounded-lg border border-hairline bg-surface p-3 shadow-pop [--float-rotate:-4deg] xl:block">
          <div className="flex items-center gap-2">
            <BotTile color={LandingBots.MARKETING.color} icon={LandingBots.MARKETING.icon} size={24} />
            <span className="text-[13px] font-extrabold text-ink">{LandingBots.MARKETING.name}</span>
          </div>
          <p className="mt-1.5 text-[13px] font-medium text-body">3 launch posts drafted. Want to review?</p>
        </div>
        <div className="absolute -right-12 -top-16 z-10 hidden w-[220px] animate-float-slow rounded-lg border border-hairline bg-surface p-3 shadow-pop [--float-rotate:3deg] xl:block">
          <div className="flex items-center gap-2">
            <BotTile color={LandingBots.ANALYST.color} icon={LandingBots.ANALYST.icon} size={24} />
            <span className="text-[13px] font-extrabold text-ink">{LandingBots.ANALYST.name}</span>
          </div>
          <div className="mt-2 flex h-10 items-end gap-1">
            {[40, 65, 50, 80, 70, 95].map((h, i) => (
              <span key={i} className="flex-1 rounded-t-[3px] bg-sunshine" style={{ height: `${h}%`, opacity: 0.45 + i * 0.1 }} />
            ))}
          </div>
          <p className="mt-1.5 flex items-center gap-1 text-[12px] font-bold text-muted-foreground">
            <BarChart3 className="h-3 w-3" /> Revenue dashboard published
          </p>
        </div>
      </div>
    </div>

    <IntegrationsMarquee />
  </section>
);

const IntegrationsMarquee: FC = () => (
  <div className="relative border-y border-hairline bg-surface-soft py-6">
    <p className="mb-4 flex items-center justify-center gap-1.5 text-center text-[12px] font-extrabold uppercase tracking-[1.2px] text-muted-foreground">
      <Sparkles className="h-3.5 w-3.5" /> Works with the tools your team already uses
    </p>
    <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
      <div className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused]">
        {[...LandingIntegrations, ...LandingIntegrations].map((name, i) => (
          <span key={`${name}-${i}`} aria-hidden={i >= LandingIntegrations.length} className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-4 py-2 text-[14px] font-bold text-body shadow-sticker">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: HERO_BOTS[i % HERO_BOTS.length].color }} />
            {name}
          </span>
        ))}
      </div>
    </div>
  </div>
);
