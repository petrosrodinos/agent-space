import { LandingNav } from "@/pages/landing/components/landing-nav";
import { LandingHero } from "@/pages/landing/components/landing-hero";
import { LandingFeatures } from "@/pages/landing/components/landing-features";
import { LandingControl, LandingFinalCta, LandingFooter, LandingHowItWorks, LandingPlatformsSection, LandingTeamsSection } from "@/pages/landing/components/landing-sections";

/** Public marketing page (PRODUCT.md): what Agent Space is, how it works and who it's for. */
export default function LandingPage() {
  return (
    <div className="min-h-dvh w-full overflow-x-clip bg-canvas text-ink">
      <LandingNav />
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingTeamsSection />
        <LandingControl />
        <LandingPlatformsSection />
        <LandingFinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
