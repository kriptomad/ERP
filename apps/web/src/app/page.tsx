import { HeroSection } from './_components/HeroSection';
import { NicheShowcaseSection } from './_components/NicheShowcaseSection';
import { PricingCalculatorSection } from './_components/PricingCalculatorSection';
import { SocialProofSection } from './_components/SocialProofSection';

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <HeroSection />
      <NicheShowcaseSection />
      <PricingCalculatorSection />
      <SocialProofSection />
    </main>
  );
}
