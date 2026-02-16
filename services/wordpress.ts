
import { WPPost } from '../types';

const BASE_URL = 'https://www.rideinchina.com/wp-json/wp/v2';

export const fetchRoutes = async (): Promise<WPPost[]> => {
  try {
    // 抓取分类为 routes 的文章 (假设 ID 为 10, 实际需根据 WP 后台确认)
    const response = await fetch(`${BASE_URL}/posts?_embed&per_page=10`);
    const data = await response.json();
    return data.map((post: any) => ({
      id: post.id,
      title: post.title.rendered,
      excerpt: post.excerpt.rendered.replace(/<[^>]*>?/gm, '').substring(0, 100) + '...',
      content: post.content.rendered,
      featured_image: post._embedded?.['wp:featuredmedia']?.[0]?.source_url || `https://picsum.photos/seed/${post.id}/800/450`,
      date: post.date,
      category: 'route',
      difficulty: post.meta?.difficulty || 'Moderate',
      distance: post.meta?.distance || 'Variable',
      duration: post.meta?.duration || 'Multi-day'
    }));
  } catch (error) {
    console.error("WP Fetch Error:", error);
    return []; // 失败时返回空数组或 Mock 数据
  }
};

export const fetchBlogs = async (): Promise<WPPost[]> => {
  try {
    // 抓取日记/博客类文章
    const response = await fetch(`${BASE_URL}/posts?categories=1&_embed&per_page=5`);
    const data = await response.json();
    return data.map((post: any) => ({
      id: post.id,
      title: post.title.rendered,
      excerpt: post.excerpt.rendered.replace(/<[^>]*>?/gm, '').substring(0, 80) + '...',
      content: post.content.rendered,
      featured_image: post._embedded?.['wp:featuredmedia']?.[0]?.source_url || `https://picsum.photos/seed/blog${post.id}/400/300`,
      date: post.date,
      category: 'blog'
    }));
  } catch (error) {
    return [];
  }
};
