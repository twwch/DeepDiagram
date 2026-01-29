import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import readingTime from 'reading-time';
import type { BlogPost, DocPage, BlogFrontmatter, DocFrontmatter } from './types';

/** Extract the first image URL from MDX content */
export function getFirstContentImage(content: string): string | null {
  const match = content.match(/!\[.*?\]\((.*?)\)/);
  return match?.[1] || null;
}

const BLOG_DIR = path.join(process.cwd(), 'src/content/blog');
const DOCS_DIR = path.join(process.cwd(), 'src/content/docs');

export function getAllPosts(locale: string): BlogPost[] {
  const dir = path.join(BLOG_DIR, locale);
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.mdx'));

  const posts = files
    .map((filename) => {
      const slug = filename.replace(/\.mdx$/, '');
      const filePath = path.join(dir, filename);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const { data, content } = matter(fileContent);
      const frontmatter = data as BlogFrontmatter;

      if (frontmatter.draft && process.env.NODE_ENV === 'production') {
        return null;
      }

      return {
        slug,
        locale,
        frontmatter,
        content,
        readingTime: Math.ceil(readingTime(content).minutes),
      };
    })
    .filter(Boolean) as BlogPost[];

  return posts.sort((a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime());
}

export function getPostBySlug(slug: string, locale: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, locale, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(fileContent);
  const frontmatter = data as BlogFrontmatter;

  return {
    slug,
    locale,
    frontmatter,
    content,
    readingTime: Math.ceil(readingTime(content).minutes),
  };
}

export function getPostsByCategory(category: string, locale: string): BlogPost[] {
  return getAllPosts(locale).filter(p => p.frontmatter.category === category);
}

export function getAllCategories(locale: string): string[] {
  const posts = getAllPosts(locale);
  return [...new Set(posts.map(p => p.frontmatter.category))];
}

export function getAllDocs(locale: string): DocPage[] {
  const dir = path.join(DOCS_DIR, locale);
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.mdx'));

  return files
    .map((filename) => {
      const slug = filename.replace(/\.mdx$/, '');
      const filePath = path.join(dir, filename);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const { data, content } = matter(fileContent);

      return {
        slug,
        locale,
        frontmatter: data as DocFrontmatter,
        content,
      };
    })
    .sort((a, b) => (a.frontmatter.order || 0) - (b.frontmatter.order || 0));
}

export function getDocBySlug(slug: string, locale: string): DocPage | null {
  const filePath = path.join(DOCS_DIR, locale, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(fileContent);

  return {
    slug,
    locale,
    frontmatter: data as DocFrontmatter,
    content,
  };
}
