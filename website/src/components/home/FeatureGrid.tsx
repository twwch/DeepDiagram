'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Section } from '@/components/ui/Section';
import { Brain, GitBranch, BarChart3, Cpu, Share2, Image } from 'lucide-react';

const agents = [
  { key: 'mindmap', icon: Brain, color: 'text-purple-600', bg: 'bg-purple-50' },
  { key: 'flowchart', icon: GitBranch, color: 'text-blue-600', bg: 'bg-blue-50' },
  { key: 'chart', icon: BarChart3, color: 'text-green-600', bg: 'bg-green-50' },
  { key: 'drawio', icon: Cpu, color: 'text-orange-600', bg: 'bg-orange-50' },
  { key: 'mermaid', icon: Share2, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  { key: 'infographic', icon: Image, color: 'text-pink-600', bg: 'bg-pink-50' },
] as const;

export function FeatureGrid() {
  const t = useTranslations('features');

  return (
    <Section className="bg-gray-50" id="features">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          {t('sectionTitle')}
        </h2>
        <p className="mt-4 text-lg text-gray-600">
          {t('sectionSubtitle')}
        </p>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent, i) => {
          const Icon = agent.icon;
          return (
            <motion.div
              key={agent.key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-gray-300 hover:shadow-lg"
            >
              <div className={`inline-flex rounded-lg p-2.5 ${agent.bg}`}>
                <Icon className={`h-5 w-5 ${agent.color}`} />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                {t(`${agent.key}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {t(`${agent.key}.desc`)}
              </p>
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}
