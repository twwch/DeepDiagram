import { ImageResponse } from 'next/og';
import { type NextRequest } from 'next/server';

export const runtime = 'nodejs';

const categoryLabels: Record<string, { zh: string; en: string }> = {
  announcements: { zh: '公告', en: 'Announcements' },
  tutorials: { zh: '教程', en: 'Tutorials' },
  engineering: { zh: '工程', en: 'Engineering' },
  updates: { zh: '更新', en: 'Updates' },
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get('title') || 'DeepDiagram AI';
  const category = searchParams.get('category') || '';
  const locale = searchParams.get('locale') || 'zh';
  const date = searchParams.get('date') || '';

  const categoryLabel = categoryLabels[category]?.[locale as 'zh' | 'en'] || category;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 80px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Top: Logo + Category */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '14px',
                background: 'rgba(255,255,255,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                fontWeight: 800,
                color: 'white',
              }}
            >
              D
            </div>
            <span style={{ fontSize: '26px', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
              DeepDiagram
            </span>
          </div>
          {categoryLabel && (
            <div
              style={{
                padding: '8px 24px',
                borderRadius: '100px',
                background: 'rgba(255,255,255,0.2)',
                fontSize: '18px',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              {categoryLabel}
            </div>
          )}
        </div>

        {/* Center: Title */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            flex: 1,
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontSize: title.length > 30 ? '44px' : '52px',
              fontWeight: 800,
              color: 'white',
              lineHeight: 1.3,
              letterSpacing: '-0.02em',
              textShadow: '0 2px 20px rgba(0,0,0,0.15)',
              maxWidth: '900px',
            }}
          >
            {title}
          </div>
        </div>

        {/* Bottom: Date + URL */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '20px', color: 'rgba(255,255,255,0.7)' }}>
            {date || 'deepdiagram.ai'}
          </span>
          <span style={{ fontSize: '20px', color: 'rgba(255,255,255,0.6)' }}>
            cturing.cn
          </span>
        </div>

        {/* Decorative elements */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            right: '-100px',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-80px',
            left: '-80px',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
