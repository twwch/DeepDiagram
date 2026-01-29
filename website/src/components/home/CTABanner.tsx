'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { ArrowRight, Github } from 'lucide-react';

export function CTABanner() {
  const t = useTranslations('cta');

  return (
    <Section>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 px-8 py-20 text-center sm:px-16"
      >
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Glow blobs */}
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute left-1/2 top-0 h-48 w-48 -translate-x-1/2 rounded-full bg-purple-500/10 blur-3xl" />

        {/* Decorative rings */}
        <div className="absolute left-[10%] top-[15%] h-24 w-24 rounded-full border border-blue-400/10" />
        <div className="absolute bottom-[10%] right-[12%] h-16 w-16 rounded-full border border-indigo-400/15" />

        {/* Dots */}
        <div className="absolute left-[20%] top-[30%] h-1.5 w-1.5 rounded-full bg-blue-400/50" />
        <div className="absolute bottom-[25%] right-[25%] h-1 w-1 rounded-full bg-indigo-400/50" />
        <div className="absolute right-[35%] top-[20%] h-2 w-2 rounded-full bg-purple-400/40" />

        <h2 className="relative text-3xl font-bold text-white sm:text-4xl">
          {t('title')}
        </h2>
        <p className="relative mt-4 text-lg text-blue-200/80">
          {t('subtitle')}
        </p>
        <div className="relative mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button href="https://deepd.cturing.cn/app" external size="lg" className="border border-white/20 bg-white text-primary-700 shadow-lg shadow-blue-500/20 hover:bg-gray-100">
            {t('button')}
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button href="https://github.com/twwch/DeepDiagram" external variant="secondary" size="lg" className="border border-white/10 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20">
            <Github className="h-4 w-4" />
            GitHub
          </Button>
        </div>
      </motion.div>
    </Section>
  );
}
