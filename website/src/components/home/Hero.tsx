'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Container } from '@/components/ui/Container';
import { ArrowRight, Github, Sparkles } from 'lucide-react';

export function Hero() {
  const t = useTranslations('hero');

  return (
    <section className="relative overflow-hidden bg-white pt-16 pb-20 sm:pt-24 sm:pb-28">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-gradient-to-br from-primary-100/50 via-blue-50/30 to-transparent blur-3xl" />
        <div className="absolute top-40 right-0 h-[300px] w-[400px] rounded-full bg-gradient-to-l from-purple-100/30 to-transparent blur-3xl" />
      </div>

      <Container className="text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Badge className="mb-6">
            <Sparkles className="mr-1.5 h-3 w-3" />
            {t('badge')}
          </Badge>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto max-w-4xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl"
        >
          {t('title')}
          <span className="bg-gradient-to-r from-primary-600 to-blue-500 bg-clip-text text-transparent">
            {' '}{t('titleHighlight')}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600"
        >
          {t('subtitle')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Button href="https://deepd.cturing.cn/app" external size="lg">
            {t('cta')}
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button href="https://github.com/twwch/DeepDiagram" external variant="secondary" size="lg">
            <Github className="h-4 w-4" />
            {t('secondaryCta')}
          </Button>
        </motion.div>

        {/* Product screenshot/demo */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-16 sm:mt-20"
        >
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-xl border border-gray-200 bg-gray-900 shadow-2xl">
            <div className="flex items-center gap-1.5 border-b border-gray-700 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-500/80" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
              <div className="h-3 w-3 rounded-full bg-green-500/80" />
              <span className="ml-3 text-xs text-gray-400">deepd.cturing.cn/app</span>
            </div>
            <video
              autoPlay
              loop
              muted
              playsInline
              width={960}
              height={470}
              className="w-full"
            >
              <source src="/images/demo.mp4" type="video/mp4" />
            </video>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
