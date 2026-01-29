export interface BlogFrontmatter {
  title: string;
  description: string;
  date: string;
  author: string;
  category: string;
  tags: string[];
  image?: string;
  draft?: boolean;
}

export interface BlogPost {
  slug: string;
  locale: string;
  frontmatter: BlogFrontmatter;
  content: string;
  readingTime: number;
}

export interface DocFrontmatter {
  title: string;
  description: string;
  order: number;
}

export interface DocPage {
  slug: string;
  locale: string;
  frontmatter: DocFrontmatter;
  content: string;
}
