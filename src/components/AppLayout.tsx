import React from 'react';
import Header from '@/components/site/Header';
import Hero from '@/components/site/Hero';
import {
  Services,
  HowItWorks,
  EmergencyBand,
  Fleets,
  Coverage,
  MobileCallBar,
} from '@/components/site/Sections';
import { Reviews, RoadNotes, FaqSection } from '@/components/site/ReviewsNotesFaq';
import { Contact, Footer } from '@/components/site/ContactFooter';
import { IconGradients } from '@/components/site/ServiceIcons';
import { usePublicContent } from '@/lib/public-data';

/**
 * The public marketing site — a faithful reproduction of the approved
 * prototype. Section order and copy are fixed; reviews, road notes and FAQs
 * come from the database (published rows only) so staff can edit them in the
 * dashboard without touching code.
 */
const AppLayout: React.FC = () => {
  const { reviews, notes, faqs } = usePublicContent();

  return (
    <div className="min-h-screen bg-ink">
      {/* Shared SVG gradient definitions for the dimensional service icons */}
      <IconGradients />

      <a
        href="#top"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-amber focus:px-4 focus:py-2 focus:font-semibold focus:text-ink"
      >
        Skip to content
      </a>

      <Header />

      <main>
        <Hero />
        <Services />
        <HowItWorks />
        <EmergencyBand />
        <Fleets />
        <Coverage />
        <Reviews items={reviews} />
        <RoadNotes items={notes} />
        <FaqSection items={faqs} />
        <Contact />
      </main>

      <Footer />
      <MobileCallBar />
    </div>
  );
};

export default AppLayout;
