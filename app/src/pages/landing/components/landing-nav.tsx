import { useEffect, useState, type FC } from "react";
import { Link } from "react-router-dom";
import { Bot, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LandingNavLinks, type LandingSectionId } from "@/config/constants/landing/landing.content";
import { Routes } from "@/routes/routes";
import { cn } from "@/lib/utils";
import { useSessionBootstrap } from "@/components/layout/session-gate";
import { AuthStatuses } from "@/stores/auth";

export function scrollToSection(id: LandingSectionId) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export const LandingLogo: FC<{ className?: string }> = ({ className }) => (
  <Link to={Routes.home} className={cn("flex items-center gap-2.5", className)}>
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
      <Bot className="h-5 w-5" />
    </span>
    <span className="text-[17px] font-extrabold tracking-tight text-ink">Agent Space</span>
  </Link>
);

export const LandingNav: FC = () => {
  const signedIn = useSessionBootstrap() === AuthStatuses.SIGNED_IN;
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("sticky top-0 z-40 w-full transition-[background-color,border-color,backdrop-filter] duration-200", scrolled ? "border-b border-hairline bg-canvas/80 backdrop-blur-xl" : "border-b border-transparent")}>
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-4 sm:px-6">
        <LandingLogo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
          {LandingNavLinks.map((l) => (
            <button key={l.id} type="button" onClick={() => scrollToSection(l.id)} className="rounded-full px-3.5 py-2 text-sm font-semibold text-body transition-colors hover:bg-surface-sunken hover:text-ink">
              {l.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <Button asChild>
              <Link to={Routes.chat.root}>Open app</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link to={Routes.auth.sign_in}>Sign in</Link>
              </Button>
              <Button asChild>
                <Link to={Routes.auth.sign_up}>Get started</Link>
              </Button>
            </>
          )}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] bg-canvas">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="mt-10 flex flex-col gap-1">
                {LandingNavLinks.map((l) => (
                  <SheetClose asChild key={l.id}>
                    <button type="button" onClick={() => setTimeout(() => scrollToSection(l.id), 250)} className="rounded-md px-3 py-3 text-left text-[15px] font-bold text-ink hover:bg-surface-sunken">
                      {l.label}
                    </button>
                  </SheetClose>
                ))}
                {!signedIn && (
                  <Button asChild variant="outline" className="mt-4">
                    <Link to={Routes.auth.sign_in}>Sign in</Link>
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};
