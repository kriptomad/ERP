import { HeroSection } from './_components/HeroSection';
import { NicheShowcaseSection } from './_components/NicheShowcaseSection';
import { PricingCalculatorSection } from './_components/PricingCalculatorSection';
import { SocialProofSection } from './_components/SocialProofSection';
import { Footer } from './_components/Footer';

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <HeroSection />
      <NicheShowcaseSection />
      <PricingCalculatorSection />
      <SocialProofSection />
      <Footer />
    </main>
  );
}