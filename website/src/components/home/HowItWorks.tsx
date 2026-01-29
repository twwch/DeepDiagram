'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Section } from '@/components/ui/Section';
import { MessageSquare, Wand2, Download } from 'lucide-react';

const steps = [
  { key: 'step1', icon: MessageSquare, color: 'bg-blue-600' },
  { key: 'step2', icon: Wand2, color: 'bg-purple-600' },
  { key: 'step3', icon: Download, color: 'bg-green-600' },
];

export function HowItWorks() {
  const t = useTranslations('howItWorks');

  return (
    <Section id="how-it-works">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          {t('title')}
        </h2>
      </div>

      <div className="mt-16 grid gap-8 sm:grid-cols-3">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={step.key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.15 }}
              className="relative text-center"
            >
              {/* Step number connector line */}
              {i < steps.length - 1 && (
                <div className="absolute top-8 left-1/2 hidden h-0.5 w-full bg-gray-200 sm:block" />
              )}
              <div className={`relative z-10 mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${step.color} text-white shadow-lg`}>
                <Icon className="h-7 w-7" />
              </div>
              <div className="mt-2 text-sm font-medium text-gray-400">0{i + 1}</div>
              <h3 className="mt-2 text-lg font-semibold text-gray-900">
                {t(`${step.key}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {t(`${step.key}.desc`)}
              </p>
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}
