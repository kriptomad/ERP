import { HeroSection } from "./_components/hero-section";
import { ProductsSection } from "./_components/products-section";
import { NicheShowcaseSection } from "./_components/niche-showcase-section";
import { PricingCalculatorSection } from "./_components/pricing-calculator-section";

export default function LandingPage() {
  return (
    <main className="bg-canvas text-zinc-100 overflow-x-hidden">
      <HeroSection />
      <ProductsSection />
      <NicheShowcaseSection />
      <PricingCalculatorSection />
    </main>
  );
}
